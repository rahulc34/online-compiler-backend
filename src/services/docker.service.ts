import { PassThrough } from "node:stream";
import { randomUUID } from "node:crypto";
import Docker from "dockerode";

import {
  createSourceArchive,
  SourceFile,
} from "../utils/create-source-archive";

const docker = new Docker();

interface CreateSandboxOptions {
  image: string;
  memoryLimit?: number;
  cpuLimit?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  memoryUsed: number;
}

interface ExecuteCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
  trackMemoryUsage?: boolean;
}

// --------------------------------------------------
// 1. Create isolated container
// --------------------------------------------------

export const createSandboxContainer = async ({
  image,
  memoryLimit = 256 * 1024 * 1024,
  cpuLimit = 500_000_000,
}: CreateSandboxOptions) => {
  const container = await docker.createContainer({
    Image: image,
    Cmd: ["sh", "-c", "sleep infinity"],
    Env: ["TMPDIR=/tmp/compiler"],

    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges:true"],
      Memory: memoryLimit,
      NanoCpus: cpuLimit,
      PidsLimit: 64,

      Tmpfs: {
        "/workspace": "rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001",
        "/tmp/compiler": "rw,exec,nosuid,nodev,size=32m,uid=10001,gid=10001",
      },

      AutoRemove: false,
    },

    AttachStdout: false,
    AttachStderr: false,
    OpenStdin: false,
    Tty: false,
  });

  await container.start();

  return container;
};

// --------------------------------------------------
// 2. Wait until Docker exec process exits
// --------------------------------------------------

const waitForExecCompletion = async (
  exec: Docker.Exec,
  timeoutMs: number,
): Promise<number> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const inspection = await exec.inspect();

    if (!inspection.Running) {
      return inspection.ExitCode ?? 1;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Docker exec process did not finish in time");
};

const startMemoryMonitor = async (container: Docker.Container) => {
  let peakMemory = 0;
  let buffer = "";

  const statsStream = await container.stats({ stream: true });

  const processStats = (raw: string) => {
    try {
      const stats = JSON.parse(raw);
      const memoryStats = stats.memory_stats;

      if (typeof memoryStats?.usage !== "number") return;

      const cache =
        memoryStats.stats?.inactive_file ??
        memoryStats.stats?.total_inactive_file ??
        0;

      const currentMemory = Math.max(0, memoryStats.usage - cache);

      peakMemory = Math.max(peakMemory, currentMemory);
    } catch {
      // Ignore incomplete or malformed stats records.
    }
  };

  statsStream.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) processStats(line);
    }
  });

  return {
    stop: async () => {
      if (buffer.trim()) processStats(buffer);

      (
        statsStream as NodeJS.ReadableStream & {
          destroy: () => void;
        }
      ).destroy();

      return peakMemory;
    },
  };
};

// --------------------------------------------------
// 3. Copy source files into container
// --------------------------------------------------

export const copySourceFiles = async (
  container: Docker.Container,
  files: SourceFile[],
): Promise<void> => {
  const archive = await createSourceArchive(files);

  const exec = await container.exec({
    Cmd: ["tar", "-x", "-C", "/workspace"],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true,
  });

  const stdout = new PassThrough();
  const stderrStream = new PassThrough();

  let stderr = "";

  stderrStream.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const streamEnded = new Promise<void>((resolve, reject) => {
    stream.once("end", resolve);
    stream.once("error", reject);
  });

  docker.modem.demuxStream(stream, stdout, stderrStream);

  stdout.resume();
  stderrStream.resume();

  stream.end(archive);

  try {
    await streamEnded;

    const exitCode = await waitForExecCompletion(exec, 5000);

    if (exitCode !== 0) {
      throw new Error(
        `Source extraction failed (exit code: ${exitCode}): ${stderr}`,
      );
    }
  } finally {
    stdout.destroy();
    stderrStream.destroy();
    stream.destroy();
  }
};

// --------------------------------------------------
// 4. Execute command
// --------------------------------------------------

export const executeCommand = async (
  container: Docker.Container,
  command: string[],
  {
    timeoutMs = 5000,
    maxOutputBytes = 1024 * 1024,
    stdin = "",
    trackMemoryUsage = false,
  }: ExecuteCommandOptions = {},
): Promise<CommandResult> => {
  let commandToRun = command;

  // Store stdin in a temporary file instead of
  // attaching it to the Docker exec input stream.

  if (stdin.length > 0) {
    const inputFileName = `.compiler-stdin-${randomUUID()}`;
    const inputFilePath = `/workspace/${inputFileName}`;

    await copySourceFiles(container, [
      {
        name: inputFileName,
        content: stdin,
      },
    ]);

    commandToRun = [
      "sh",
      "-c",
      'input_file=$1; shift; "$@" < "$input_file"; status=$?; rm -f -- "$input_file"; exit "$status"',
      "sh",
      inputFilePath,
      ...command,
    ];
  }

  const exec = await container.exec({
    Cmd: commandToRun,
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: false,
    Tty: false,
  });

  const memoryMonitor = trackMemoryUsage
    ? await startMemoryMonitor(container).catch((error) => {
        console.error("Docker memory monitoring failed:", error);
        return null;
      })
    : null;

  const stream = await exec.start({
    hijack: true,
    stdin: false,
  });

  return new Promise<CommandResult>((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    let outputBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    let terminationRequested = false;

    const stdout = new PassThrough();
    const stderr = new PassThrough();

    const cleanup = () => {
      clearTimeout(timer);
      stdout.destroy();
      stderr.destroy();
    };

    const terminateContainer = async () => {
      if (terminationRequested) return;

      terminationRequested = true;

      try {
        await container.kill();
      } catch {
        // Container may already have stopped.
      }
    };

    const finish = async (error?: Error, exitCode = 1) => {
      if (settled) return;

      settled = true;
      cleanup();

      let memoryUsed = 0;

      try {
        memoryUsed = (await memoryMonitor?.stop()) ?? 0;
      } catch (monitorError) {
        console.error("Failed to stop Docker memory monitor:", monitorError);
      }

      if (error) {
        reject(error);
        return;
      }

      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode,
        timedOut,
        outputLimitExceeded,
        memoryUsed,
      });
    };

    const collect = (target: Buffer[], chunk: Buffer) => {
      if (settled || outputLimitExceeded) return;

      const remaining = maxOutputBytes - outputBytes;

      if (remaining <= 0) {
        outputLimitExceeded = true;
        void terminateContainer();
        return;
      }

      const accepted = chunk.subarray(0, remaining);

      target.push(accepted);
      outputBytes += accepted.length;

      if (accepted.length < chunk.length) {
        outputLimitExceeded = true;
        void terminateContainer();
      }
    };

    stdout.on("data", (chunk: Buffer) => {
      collect(stdoutChunks, chunk);
    });

    stderr.on("data", (chunk: Buffer) => {
      collect(stderrChunks, chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      void terminateContainer();
    }, timeoutMs);

    stream.on("error", (error: Error) => {
      if (!terminationRequested) {
        finish(error);
      }
    });

    stream.on("end", async () => {
      if (settled) return;

      if (timedOut || outputLimitExceeded) {
        finish();
        return;
      }

      try {
        const exitCode = await waitForExecCompletion(exec, 2000);

        finish(undefined, exitCode);
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("Unable to inspect Docker execution"),
        );
      }
    });

    docker.modem.demuxStream(stream, stdout, stderr);

    stream.resume();
  });
};

// --------------------------------------------------
// 5. Remove container
// --------------------------------------------------

export const removeSandboxContainer = async (
  container: Docker.Container,
): Promise<void> => {
  try {
    await container.stop({ t: 1 });
  } catch {
    // Container may already be stopped.
  }

  try {
    await container.remove({ force: true });
  } catch (error) {
    console.error("Failed to remove Docker container:", error);
  }
};

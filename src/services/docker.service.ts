import Docker from "dockerode";
import {
  createSourceArchive,
  SourceFile,
} from "../utils/create-source-archive";
import { PassThrough } from "stream";

const docker = new Docker();

interface CreateSandboxOptions {
  image: string;
  memoryLimit?: number;
  cpuLimit?: number;
}

export const createSandboxContainer = async ({
  image,
  memoryLimit = 256 * 1024 * 1024,
  cpuLimit = 500_000_000,
}: CreateSandboxOptions) => {
  const container = await docker.createContainer({
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

export const copySourceFiles = async (
  container: Docker.Container,
  files: SourceFile[],
): Promise<void> => {
  const archive = await createSourceArchive(files);

  await container.putArchive(archive, {
    path: "/workspace",
  });
};
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

interface ExecuteCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

interface ExecuteCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

interface ExecuteCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  stdin?: string;
}

export const executeCommand = async (
  container: Docker.Container,
  command: string[],
  {
    timeoutMs = 5000,
    maxOutputBytes = 1024 * 1024,
    stdin = "",
  }: ExecuteCommandOptions = {},
): Promise<CommandResult> => {
  const exec = await container.exec({
    Cmd: command,
    AttachStdout: true,
    AttachStderr: true,
    AttachStdin: true,
    Tty: false,
  });

  const stream = await exec.start({
    hijack: true,
    stdin: true,
  });

  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    let outputBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    let settled = false;
    let sourceEnded = false;
    let stdoutEnded = false;
    let stderrEnded = false;
    let terminationRequested = false;
    let terminationTimer: ReturnType<typeof setTimeout> | undefined;

    const stdout = new PassThrough();
    const stderr = new PassThrough();

    const cleanup = () => {
      clearTimeout(timer);

      if (terminationTimer) {
        clearTimeout(terminationTimer);
      }
    };

    const terminateContainer = async () => {
      if (terminationRequested) return;
      terminationRequested = true;

      try {
        await container.kill();
      } catch {
        // Container may already have stopped.
      }

      // Prevent a permanently pending promise if Docker
      // does not close the execution stream after termination.
      terminationTimer = setTimeout(() => {
        stream.destroy();
      }, 1000);
    };

    const finish = async (error?: Error) => {
      if (settled) return;

      settled = true;
      cleanup();

      if (error) {
        reject(error);
        return;
      }

      const result: CommandResult = {
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: 1,
        timedOut,
        outputLimitExceeded,
      };

      if (timedOut || outputLimitExceeded) {
        resolve(result);
        return;
      }

      try {
        const inspection = await exec.inspect();

        resolve({
          ...result,
          exitCode: inspection.ExitCode ?? 1,
        });
      } catch (inspectionError) {
        reject(inspectionError);
      }
    };

    const checkCompletion = () => {
      if (sourceEnded && stdoutEnded && stderrEnded) {
        void finish();
      }
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

    stdout.on("end", () => {
      stdoutEnded = true;
      checkCompletion();
    });

    stderr.on("end", () => {
      stderrEnded = true;
      checkCompletion();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      void terminateContainer();
    }, timeoutMs);

    stream.on("end", () => {
      sourceEnded = true;
      checkCompletion();
    });

    stream.on("error", (error: Error) => {
      if (terminationRequested) {
        sourceEnded = true;
        stdout.end();
        stderr.end();
        checkCompletion();
      } else {
        void finish(error);
      }
    });

    stream.on("close", () => {
      sourceEnded = true;

      // No more source data can arrive after close.
      stdout.end();
      stderr.end();

      checkCompletion();
    });

    docker.modem.demuxStream(stream, stdout, stderr);

    // Send stdin and signal EOF.
    stream.end(stdin);
  });
};

export const removeSandboxContainer = async (
  container: Docker.Container,
): Promise<void> => {
  try {
    await container.stop({ t: 1 });
  } catch {
    // It may already be stopped.
  }

  try {
    await container.remove({ force: true });
  } catch (error) {
    console.error("Failed to remove Docker container:", error);
  }
};

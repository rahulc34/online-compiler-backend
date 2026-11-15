import {
  createSandboxContainer,
  copySourceFiles,
  executeCommand,
  removeSandboxContainer,
} from "./docker.service";

import type { SourceFile } from "../utils/create-source-archive";

interface JavaExecutionOptions {
  executionId: string;
  files: SourceFile[];
  stdin?: string;
}

export interface JavaExecutionResult {
  status:
    | "success"
    | "compilation_error"
    | "runtime_error"
    | "timeout"
    | "internal_error";
  stdout: string;
  stderr: string;
  compilationTime: number;
  executionTime: number;
  exitCode: number | null;
  memoryUsed: number;
}

export const executeJava = async ({
  executionId,
  files,
  stdin = "",
}: JavaExecutionOptions): Promise<JavaExecutionResult> => {
  let container;
  let memoryUsed = 0;

  try {
    const mainFile = files.find((file) => file.name === "Main.java");

    if (!mainFile) {
      return {
        status: "compilation_error",
        stdout: "",
        stderr: "Entry file Main.java not found",
        compilationTime: 0,
        executionTime: 0,
        exitCode: null,
        memoryUsed,
      };
    }

    container = await createSandboxContainer({
      image: "compiler-java:latest",
      executionId,
      memoryLimit: 256 * 1024 * 1024,
      cpuLimit: 500_000_000,
    });

    await copySourceFiles(container, files);

    // Compilation
    const compilationStart = Date.now();

    const compilation = await executeCommand(
      container,
      ["javac", "-d", "/tmp/compiler", "/workspace/Main.java"],
      {
        timeoutMs: 10_000,
        maxOutputBytes: 1024 * 1024,
      },
    );

    const compilationTime = Date.now() - compilationStart;

    if (compilation.timedOut) {
      return {
        status: "timeout",
        stdout: "",
        stderr: "Compilation time limit exceeded",
        compilationTime,
        executionTime: 0,
        exitCode: null,
        memoryUsed,
      };
    }

    if (compilation.outputLimitExceeded) {
      return {
        status: "compilation_error",
        stdout: compilation.stdout,
        stderr: "Compilation output limit exceeded",
        compilationTime,
        executionTime: 0,
        exitCode: compilation.exitCode,
        memoryUsed,
      };
    }

    if (compilation.exitCode !== 0) {
      return {
        status: "compilation_error",
        stdout: compilation.stdout,
        stderr: compilation.stderr,
        compilationTime,
        executionTime: 0,
        exitCode: compilation.exitCode,
        memoryUsed,
      };
    }

    // Execution
    const executionStart = Date.now();

    const execution = await executeCommand(
      container,
      ["java", "-cp", "/tmp/compiler", "Main"],
      {
        timeoutMs: 5000,
        maxOutputBytes: 1024 * 1024,
        stdin,
        trackMemoryUsage: true,
      },
    );

    memoryUsed = execution.memoryUsed;
    const executionTime = Date.now() - executionStart;

    if (execution.timedOut) {
      return {
        status: "timeout",
        stdout: execution.stdout,
        stderr: "Execution time limit exceeded",
        compilationTime,
        executionTime,
        exitCode: null,
        memoryUsed,
      };
    }

    if (execution.outputLimitExceeded) {
      return {
        status: "runtime_error",
        stdout: execution.stdout,
        stderr: "Execution output limit exceeded",
        compilationTime,
        executionTime,
        exitCode: execution.exitCode,
        memoryUsed,
      };
    }

    return {
      status: execution.exitCode === 0 ? "success" : "runtime_error",
      stdout: execution.stdout,
      stderr: execution.stderr,
      compilationTime,
      executionTime,
      exitCode: execution.exitCode,
      memoryUsed,
    };
  } catch (error) {
    console.error("Java execution failed:", error);

    return {
      status: "internal_error",
      stdout: "",
      stderr: "Internal execution error",
      compilationTime: 0,
      executionTime: 0,
      exitCode: null,
      memoryUsed,
    };
  } finally {
    if (container) {
      try {
        await removeSandboxContainer(container, executionId);
      } catch (error) {
        console.error("Java container cleanup failed:", error);
      }
    }
  }
};

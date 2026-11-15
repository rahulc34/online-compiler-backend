import {
  createSandboxContainer,
  copySourceFiles,
  executeCommand,
  removeSandboxContainer,
} from "./docker.service";

import type { SourceFile } from "../utils/create-source-archive";

interface CppExecutionOptions {
  files: SourceFile[];
  stdin?: string;
}

export interface CppExecutionResult {
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
}

export const executeCpp = async ({
  files,
  stdin = "",
}: CppExecutionOptions): Promise<CppExecutionResult> => {
  let container;

  try {
    // Validate the entrypoint.
    const mainFile = files.find((file) => file.name === "main.cpp");

    if (!mainFile) {
      return {
        status: "compilation_error",
        stdout: "",
        stderr: "Entry file main.cpp not found",
        compilationTime: 0,
        executionTime: 0,
        exitCode: null,
      };
    }

    // Create isolated Docker container.
    container = await createSandboxContainer({
      image: "compiler-cpp:latest",
      memoryLimit: 256 * 1024 * 1024,
      cpuLimit: 500_000_000,
    });

    // Copy submitted files into /workspace.
    await copySourceFiles(container, files);

    // Compile C++ source.
    const compilationStart = Date.now();

    const compilation = await executeCommand(
      container,
      ["/tmp/compiler/program"],
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
      };
    }

    // Execute compiled program with user-provided stdin.
    const executionStart = Date.now();

    const execution = await executeCommand(container, ["/workspace/program"], {
      timeoutMs: 5000,
      maxOutputBytes: 1024 * 1024,
      stdin,
    });

    const executionTime = Date.now() - executionStart;

    if (execution.timedOut) {
      return {
        status: "timeout",
        stdout: execution.stdout,
        stderr: "Execution time limit exceeded",
        compilationTime,
        executionTime,
        exitCode: null,
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
      };
    }

    return {
      status: execution.exitCode === 0 ? "success" : "runtime_error",
      stdout: execution.stdout,
      stderr: execution.stderr,
      compilationTime,
      executionTime,
      exitCode: execution.exitCode,
    };
  } catch (error) {
    console.error("C++ execution failed:", error);

    return {
      status: "internal_error",
      stdout: "",
      stderr: "Internal execution error",
      compilationTime: 0,
      executionTime: 0,
      exitCode: null,
    };
  } finally {
    if (container) {
      try {
        await removeSandboxContainer(container);
      } catch (error) {
        console.error("C++ container cleanup failed:", error);
      }
    }
  }
};

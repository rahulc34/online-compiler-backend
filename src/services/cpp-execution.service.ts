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

interface CppExecutionResult {
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

  let compilationTime = 0;
  let executionTime = 0;

  try {
    // 1. Validate entrypoint.
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

    // 2. Create isolated container.
    console.log("[CPP] Creating container");

    container = await createSandboxContainer({
      image: "compiler-cpp:latest",
      memoryLimit: 256 * 1024 * 1024,
      cpuLimit: 500_000_000,
    });

    console.log("[CPP] Container created");

    // 3. Copy source files.
    console.log("[CPP] Copying source files");

    await copySourceFiles(container, files);

    console.log("[CPP] Source files copied");

    // 4. Compile C++ source.
    console.log("[CPP] Starting compilation");

    const compilationStart = Date.now();
    const cppSourcePaths = files
      .filter((file) => file.name.endsWith(".cpp"))
      .map((file) => `/workspace/${file.name}`);

    const compilation = await executeCommand(
      container,
      [
        "g++",
        "-std=c++17",
        "-O2",
        "-pipe",
        "-o",
        "/tmp/compiler/program",
        ...cppSourcePaths,
      ],
      {
        timeoutMs: 10_000,
        maxOutputBytes: 1024 * 1024,
      },
    );

    compilationTime = Date.now() - compilationStart;

    console.log("[CPP] Compilation finished", {
      exitCode: compilation.exitCode,
      timedOut: compilation.timedOut,
    });

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

    // 5. Execute compiled binary.
    console.log("[CPP] Starting execution");

    const executionStart = Date.now();

    const execution = await executeCommand(
      container,
      ["/tmp/compiler/program"],
      {
        timeoutMs: 5_000,
        maxOutputBytes: 1024 * 1024,
        stdin,
      },
    );

    executionTime = Date.now() - executionStart;

    console.log("[CPP] Execution finished", {
      exitCode: execution.exitCode,
      timedOut: execution.timedOut,
    });

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

    // 6. Return execution result.
    return {
      status: execution.exitCode === 0 ? "success" : "runtime_error",
      stdout: execution.stdout,
      stderr: execution.stderr,
      compilationTime,
      executionTime,
      exitCode: execution.exitCode,
    };
  } catch (error) {
    console.error("[CPP] Execution failed:", error);

    return {
      status: "internal_error",
      stdout: "",
      stderr: "Internal execution error",
      compilationTime,
      executionTime,
      exitCode: null,
    };
  } finally {
    // 7. Always remove sandbox container.
    if (container) {
      try {
        await removeSandboxContainer(container);
        console.log("[CPP] Container removed");
      } catch (error) {
        console.error("[CPP] Container cleanup failed:", error);
      }
    }
  }
};

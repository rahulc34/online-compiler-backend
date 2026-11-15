import {
  createSandboxContainer,
  copySourceFiles,
  executeCommand,
  removeSandboxContainer,
} from "./docker.service";

import type { SourceFile } from "../utils/create-source-archive";

export interface ScriptExecutionResult {
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

interface ScriptExecutionOptions {
  executionId: string;
  language: string;
  image: string;
  entryFile: string;
  files: SourceFile[];
  stdin?: string;
  compileCommand: string[];
  runCommand: string[];
}

export const executeScriptInDocker = async ({
  executionId,
  language,
  image,
  entryFile,
  files,
  stdin = "",
  compileCommand,
  runCommand,
}: ScriptExecutionOptions): Promise<ScriptExecutionResult> => {
  let container;
  let compilationTime = 0;
  let executionTime = 0;
  let memoryUsed = 0;

  try {
    if (!files.some((file) => file.name === entryFile)) {
      return {
        status: "compilation_error",
        stdout: "",
        stderr: `Entry file ${entryFile} not found`,
        compilationTime,
        executionTime,
        exitCode: null,
        memoryUsed,
      };
    }

    container = await createSandboxContainer({ image, executionId });
    await copySourceFiles(container, files);

    const compilationStart = Date.now();
    const compilation = await executeCommand(container, compileCommand, {
      timeoutMs: 10_000,
      maxOutputBytes: 1024 * 1024,
    });
    compilationTime = Date.now() - compilationStart;

    if (compilation.timedOut) {
      return {
        status: "timeout",
        stdout: compilation.stdout,
        stderr: "Compilation time limit exceeded",
        compilationTime,
        executionTime,
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
        executionTime,
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
        executionTime,
        exitCode: compilation.exitCode,
        memoryUsed,
      };
    }

    const executionStart = Date.now();
    const execution = await executeCommand(container, runCommand, {
      timeoutMs: 5000,
      maxOutputBytes: 1024 * 1024,
      stdin,
      trackMemoryUsage: true,
    });
    memoryUsed = execution.memoryUsed;
    executionTime = Date.now() - executionStart;

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
    console.error(`[${language}] Infrastructure failure:`, error);
    throw error;
  } finally {
    if (container) {
      try {
        await removeSandboxContainer(container, executionId);
      } catch (error) {
        console.error(`[${language}] Container cleanup failed:`, error);
      }
    }
  }
};

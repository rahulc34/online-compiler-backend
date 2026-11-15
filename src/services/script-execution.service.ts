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
}

interface ScriptExecutionOptions {
  language: string;
  image: string;
  entryFile: string;
  files: SourceFile[];
  stdin?: string;
  compileCommand: string[];
  runCommand: string[];
}

export const executeScriptInDocker = async ({
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

  try {
    if (!files.some((file) => file.name === entryFile)) {
      return {
        status: "compilation_error",
        stdout: "",
        stderr: `Entry file ${entryFile} not found`,
        compilationTime,
        executionTime,
        exitCode: null,
      };
    }

    container = await createSandboxContainer({ image });
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
      };
    }

    const executionStart = Date.now();
    const execution = await executeCommand(container, runCommand, {
      timeoutMs: 5000,
      maxOutputBytes: 1024 * 1024,
      stdin,
    });
    executionTime = Date.now() - executionStart;

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
    console.error(`[${language}] Execution failed:`, error);

    return {
      status: "internal_error",
      stdout: "",
      stderr: "Internal execution error",
      compilationTime,
      executionTime,
      exitCode: null,
    };
  } finally {
    if (container) {
      try {
        await removeSandboxContainer(container);
      } catch (error) {
        console.error(`[${language}] Container cleanup failed:`, error);
      }
    }
  }
};

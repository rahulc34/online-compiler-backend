import { executeScriptInDocker } from "./script-execution.service";

import type { SourceFile } from "../utils/create-source-archive";

interface PythonExecutionOptions {
  files: SourceFile[];
  stdin?: string;
}

export const executePython = ({
  files,
  stdin,
}: PythonExecutionOptions) =>
  executeScriptInDocker({
    language: "Python",
    image: "compiler-python:latest",
    entryFile: "main.py",
    files,
    stdin,
    compileCommand: ["python3", "-m", "py_compile", "/workspace/main.py"],
    runCommand: ["python3", "/workspace/main.py"],
  });

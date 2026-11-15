import { executeScriptInDocker } from "./script-execution.service";

import type { SourceFile } from "../utils/create-source-archive";

interface JavaScriptExecutionOptions {
  files: SourceFile[];
  stdin?: string;
}

export const executeJavaScript = ({
  files,
  stdin,
}: JavaScriptExecutionOptions) =>
  executeScriptInDocker({
    language: "JavaScript",
    image: "compiler-node:latest",
    entryFile: "main.js",
    files,
    stdin,
    compileCommand: ["node", "--check", "/workspace/main.js"],
    runCommand: ["node", "/workspace/main.js"],
  });

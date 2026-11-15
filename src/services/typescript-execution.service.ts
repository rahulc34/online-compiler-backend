import { executeScriptInDocker } from "./script-execution.service";

import type { SourceFile } from "../utils/create-source-archive";

interface TypeScriptExecutionOptions {
  files: SourceFile[];
  stdin?: string;
}

export const executeTypeScript = ({
  files,
  stdin,
}: TypeScriptExecutionOptions) =>
  executeScriptInDocker({
    language: "TypeScript",
    image: "compiler-node:latest",
    entryFile: "main.ts",
    files,
    stdin,
    compileCommand: [
      "tsc",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--typeRoots",
      "/usr/local/lib/node_modules/@types",
      "--types",
      "node",
      "--outDir",
      "/tmp/compiler",
      "/workspace/main.ts",
    ],
    runCommand: ["node", "/tmp/compiler/main.js"],
  });

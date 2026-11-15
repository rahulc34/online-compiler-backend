import type { ExecutionLanguage } from "../models/execution.model";

interface LanguageConfig {
  image: string;
  sourceFile: string;
  compileCommand: string[] | null;
  runCommand: string[];
}

export const LANGUAGE_CONFIG: Record<ExecutionLanguage, LanguageConfig> = {
  cpp: {
    image: "compiler-cpp",
    sourceFile: "main.cpp",
    compileCommand: [
      "g++",
      "-std=c++17",
      "-O2",
      "-o",
      "/workspace/program",
      "/workspace/main.cpp",
    ],
    runCommand: ["/workspace/program"],
  },

  java: {
    image: "compiler-java",
    sourceFile: "Main.java",
    compileCommand: ["javac", "-d", "/workspace", "/workspace/Main.java"],
    runCommand: ["java", "-cp", "/workspace", "Main"],
  },

  python: {
    image: "compiler-python",
    sourceFile: "main.py",
    compileCommand: null,
    runCommand: ["python3", "/workspace/main.py"],
  },

  javascript: {
    image: "compiler-node",
    sourceFile: "main.js",
    compileCommand: null,
    runCommand: ["node", "/workspace/main.js"],
  },

  typescript: {
    image: "compiler-node",
    sourceFile: "main.ts",
    compileCommand: [
      "tsc",
      "/workspace/main.ts",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--outDir",
      "/workspace/dist",
    ],
    runCommand: ["node", "/workspace/dist/main.js"],
  },
};

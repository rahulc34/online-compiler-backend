import { z } from "zod";

const executionLanguageSchema = z.enum([
  "cpp",
  "java",
  "python",
  "javascript",
  "typescript",
]);

const executionFileSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(100, "File name is too long")
    .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/, "Invalid file name"),

  content: z.string().max(100_000, "File content exceeds the size limit"),
});

export const createExecutionSchema = z.object({
  language: executionLanguageSchema,

  files: z
    .array(executionFileSchema)
    .min(1, "At least one source file is required")
    .max(5, "Maximum 5 files are allowed")
    .refine(
      (files) => new Set(files.map((file) => file.name)).size === files.length,
      "Duplicate file names are not allowed",
    ),

  stdin: z.string().max(10_000, "Input exceeds the size limit").default(""),
});

export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;

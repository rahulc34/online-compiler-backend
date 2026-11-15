import mongoose from "mongoose";
import Execution from "../../models/execution.model";
import type { CreateExecutionInput } from "./execution.validation";

interface CreateExecutionOptions {
  userId: string;
  input: CreateExecutionInput;
}

export const createExecution = async ({
  userId,
  input,
}: CreateExecutionOptions) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }

  const execution = await Execution.create({
    userId,
    language: input.language,
    files: input.files,
    stdin: input.stdin,
    status: "queued",
  });

  return execution;
};

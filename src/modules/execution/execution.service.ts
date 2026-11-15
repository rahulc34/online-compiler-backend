import mongoose from "mongoose";

import Execution from "../../models/execution.model";
import { executionQueue } from "../../queues/execution.queue";
import { ApiError } from "../../utils/api-error";

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
    throw new ApiError(400, "Invalid user ID");
  }

  // 1. Save execution in MongoDB.
  const execution = await Execution.create({
    userId,
    language: input.language,
    files: input.files,
    stdin: input.stdin,
    status: "queued",
  });

  try {
    // 2. Add execution to BullMQ.
    await executionQueue.add(
      "execute",
      {
        executionId: execution._id.toString(),
      },
      {
        jobId: execution._id.toString(),
      },
    );
  } catch (error) {
    // Preserve the submission and record the queue failure.
    await Execution.updateOne(
      { _id: execution._id },
      { $set: { status: "internal_error" } },
    );

    throw new ApiError(503, "Unable to add execution to the processing queue");
  }

  return execution;
};

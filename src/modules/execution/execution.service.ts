import mongoose from "mongoose";

import Execution from "../../models/execution.model";
import { executionQueue } from "../../queues/execution.queue";
import { ApiError } from "../../utils/api-error";
import {
  reserveExecutionSlot,
  releaseExecutionSlot,
} from "../../services/execution-concurrency.service";

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

  // 1. Generate execution ID before reserving a slot.
  const executionId = new mongoose.Types.ObjectId();

  // 2. Atomically reserve an active execution slot.
  const reserved = await reserveExecutionSlot(userId, executionId.toString());

  if (!reserved) {
    throw new ApiError(
      429,
      "You already have the maximum number of active executions.",
    );
  }

  try {
    // 3. Create execution record.
    const execution = await Execution.create({
      _id: executionId,
      userId,
      language: input.language,
      files: input.files,
      stdin: input.stdin,
      status: "queued",
    });

    await executionQueue.add(
      "execute",
      { executionId: executionId.toString() },
      { jobId: executionId.toString() },
    );

    return execution;
  } catch (error) {
    // 5. Mark failed submission if its record exists.
    await Execution.updateOne(
      { _id: executionId, status: "queued" },
      {
        $set: {
          status: "internal_error",
          stderr: "Unable to submit execution",
        },
      },
    );

    // 6. Release reserved slot.
    await releaseExecutionSlot(userId, executionId.toString());

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(503, "Unable to submit execution. Please try again.");
  }
};

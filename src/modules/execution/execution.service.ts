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

  const executionId = new mongoose.Types.ObjectId();
  let slotReserved = false;

  try {
    // 1. Create the execution record first.
    const execution = await Execution.create({
      _id: executionId,
      userId,
      language: input.language,
      files: input.files,
      stdin: input.stdin,
      status: "queued",
    });

    // 2. Reserve the user's concurrency slot.
    slotReserved = await reserveExecutionSlot(userId, executionId.toString());

    if (!slotReserved) {
      await Execution.deleteOne({ _id: executionId });

      throw new ApiError(
        429,
        "You already have the maximum number of active executions.",
      );
    }

    // 3. Add the execution to BullMQ.
    await executionQueue.add(
      "execute",
      { executionId: executionId.toString() },
      { jobId: executionId.toString() },
    );

    return execution;
  } catch (error) {
    if (slotReserved) {
      try {
        await releaseExecutionSlot(userId, executionId.toString());
      } catch (releaseError) {
        console.error("Failed to release execution slot:", releaseError);
      }
    }

    await Execution.updateOne(
      { _id: executionId, status: "queued" },
      {
        $set: {
          status: "internal_error",
          stderr: "Unable to submit execution",
        },
      },
    ).catch((dbError) => {
      console.error(
        "Failed to update execution after submission error:",
        dbError,
      );
    });

    if (error instanceof ApiError) throw error;

    throw new ApiError(503, "Unable to submit execution. Please try again.");
  }
};

import mongoose from "mongoose";
import Execution from "../../models/execution.model";
import { executionQueue } from "../../queues/execution.queue";
import { ApiError } from "../../utils/api-error";
import redisConnection from "../../config/redis";

interface CancelExecutionOptions {
  executionId: string;
  userId: string;
}

const EXECUTION_CANCEL_CHANNEL = "execution:cancel";

export const cancelExecution = async ({
  executionId,
  userId,
}: CancelExecutionOptions) => {
  // 1. Validate execution ID.
  if (!mongoose.isValidObjectId(executionId)) {
    throw new ApiError(400, "Invalid execution ID");
  }

  // 2. Find execution belonging to the authenticated user.
  const execution = await Execution.findOne({
    _id: executionId,
    userId,
  }).select("status");

  if (!execution) {
    throw new ApiError(404, "Execution not found");
  }

  // 3. Handle already cancelled or cancelling executions.
  if (execution.status === "cancelled") {
    return { executionId, status: "cancelled" };
  }

  if (execution.status === "cancelling") {
    return { executionId, status: "cancelling" };
  }

  // 4. Only queued and running executions can be cancelled.
  if (execution.status !== "queued" && execution.status !== "running") {
    throw new ApiError(409, "Execution can no longer be cancelled");
  }

  // 5. Handle queued execution.
  if (execution.status === "queued") {
    const job = await executionQueue.getJob(executionId);

    if (job) {
      try {
        await job.remove();
      } catch {
        throw new ApiError(
          409,
          "Execution has already started. Please try again.",
        );
      }
    }

    const cancelled = await Execution.findOneAndUpdate(
      {
        _id: executionId,
        userId,
        status: "queued",
      },
      {
        $set: { status: "cancelled" },
      },
      { new: true },
    );

    if (!cancelled) {
      throw new ApiError(409, "Execution state changed. Please try again.");
    }

    return { executionId, status: "cancelled" };
  }

  // 6. Atomically move running execution to cancelling.
  const cancelling = await Execution.findOneAndUpdate(
    {
      _id: executionId,
      userId,
      status: "running",
    },
    {
      $set: { status: "cancelling" },
    },
    { new: true },
  );

  if (!cancelling) {
    throw new ApiError(409, "Execution state changed. Please try again.");
  }

  // 7. Notify worker through Redis Pub/Sub.
  try {
    await redisConnection.publish(
      EXECUTION_CANCEL_CHANNEL,
      JSON.stringify({ executionId }),
    );
  } catch (error) {
    console.error(`Failed to publish cancellation for ${executionId}:`, error);

    // Restore running status if publishing fails.
    await Execution.updateOne(
      {
        _id: executionId,
        status: "cancelling",
      },
      {
        $set: { status: "running" },
      },
    );

    throw new ApiError(503, "Unable to send cancellation request");
  }

  return { executionId, status: "cancelling" };
};

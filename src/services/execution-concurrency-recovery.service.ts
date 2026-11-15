import mongoose from "mongoose";
import Execution from "../models/execution.model";
import redisConnection from "../config/redis";

import { type ExecutionStatus } from "../models/execution.model";

const ACTIVE_STATUSES: ExecutionStatus[] = ["queued", "running", "cancelling"];

export const recoverExecutionConcurrencySlots = async (): Promise<void> => {
  let cursor = "0";
  let removedCount = 0;

  do {
    const [nextCursor, keys] = await redisConnection.scan(
      cursor,
      "MATCH",
      "execution:active:*",
      "COUNT",
      100,
    );

    cursor = nextCursor;

    for (const key of keys) {
      const executionIds = await redisConnection.smembers(key);

      if (executionIds.length === 0) continue;

      const validIds = executionIds.filter((id) =>
        mongoose.isValidObjectId(id),
      );

      const activeExecutions = validIds.length
        ? await Execution.find({
            _id: { $in: validIds },
            status: { $in: ACTIVE_STATUSES },
          }).distinct("_id")
        : [];

      const activeIdSet = new Set(activeExecutions.map((id) => id.toString()));

      const staleIds = executionIds.filter((id) => !activeIdSet.has(id));

      if (staleIds.length > 0) {
        removedCount += await redisConnection.srem(key, ...staleIds);
      }
    }
  } while (cursor !== "0");

  // Restore missing reservations from MongoDB.
  const activeExecutions = await Execution.find({
    status: { $in: ACTIVE_STATUSES },
  })
    .select("_id userId")
    .lean();

  for (const execution of activeExecutions) {
    const key = `execution:active:${execution.userId.toString()}`;

    await redisConnection.sadd(key, execution._id.toString());
  }

  console.log(
    `Restored concurrency reservations for ${activeExecutions.length} active executions.`,
  );
  console.log(
    `Execution concurrency recovery completed. Removed ${removedCount} stale slots.`,
  );
};

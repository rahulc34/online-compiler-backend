
import Execution from "../models/execution.model";

const STALE_EXECUTION_THRESHOLD_MS = 60_000;

export const recoverStaleExecutions = async (): Promise<void> => {
  const staleBefore = new Date(
    Date.now() - STALE_EXECUTION_THRESHOLD_MS,
  );

  const result = await Execution.updateMany(
    {
      status: { $in: ["running", "cancelling"] },
      $or: [
        { lastHeartbeatAt: { $lt: staleBefore } },
        { lastHeartbeatAt: null },
        { lastHeartbeatAt: { $exists: false } },
      ],
    },
    {
      $set: {
        status: "internal_error",
        stderr: "Execution worker stopped responding",
      },
    },
  );

  if (result.modifiedCount > 0) {
    console.log(
      `Recovered ${result.modifiedCount} stale execution(s)`,
    );
  }
};

import { Worker, Job } from "bullmq";

import redisConnection from "../config/redis";
import Execution from "../models/execution.model";

import {
  EXECUTION_QUEUE_NAME,
  ExecutionJobData,
} from "../queues/execution.queue";

import { executeCpp } from "../services/cpp-execution.service";
import { executeJava } from "../services/java-execution.service";
import { executeJavaScript } from "../services/javascript-execution.service";
import { executePython } from "../services/python-execution.service";
import { executeTypeScript } from "../services/typescript-execution.service";
import { releaseExecutionSlot } from "../services/execution-concurrency.service";

const releaseSlotSafely = async (userId: string, executionId: string) => {
  try {
    await releaseExecutionSlot(userId, executionId);
  } catch (error) {
    console.error(
      `Failed to release execution slot for ${executionId}:`,
      error,
    );
  }
};

const markExecutionCancelled = async (executionId: string) => {
  const execution = await Execution.findOneAndUpdate(
    {
      _id: executionId,
      status: "cancelling",
    },
    {
      $set: {
        status: "cancelled",
        stderr: "",
      },
    },
    {
      new: true,
    },
  ).select("userId");

  if (execution) {
    await releaseSlotSafely(execution.userId.toString(), executionId);

    console.log(`Execution ${executionId} cancelled successfully`);
  }
};

const startExecutionHeartbeat = (executionId: string) => {
  const heartbeat = setInterval(async () => {
    try {
      await Execution.updateOne(
        {
          _id: executionId,
          status: { $in: ["running", "cancelling"] },
        },
        {
          $set: {
            lastHeartbeatAt: new Date(),
          },
        },
      );
    } catch (error) {
      console.error(
        `Heartbeat update failed for execution ${executionId}:`,
        error,
      );
    }
  }, 10_000);

  return heartbeat;
};

const processExecution = async (job: Job<ExecutionJobData>) => {
  const { executionId } = job.data;

  console.log(`Processing execution: ${executionId}`);

  // Atomically claim a queued execution.
  const execution = await Execution.findOneAndUpdate(
    {
      _id: executionId,
      status: "queued",
    },
    {
      $set: {
        status: "running",
        lastHeartbeatAt: new Date(),
      },
    },
    {
      new: true,
    },
  );

  if (!execution) {
    console.log(`Execution ${executionId} is not queued or does not exist`);
    return;
  }

  const heartbeat = startExecutionHeartbeat(executionId);

  try {
    const files = execution.files.map((file) => ({
      name: file.name,
      content: file.content,
    }));

    const options = {
      executionId,
      files,
      stdin: execution.stdin,
    };

    let result;

    // Select the appropriate language execution service.
    switch (execution.language) {
      case "cpp":
        result = await executeCpp(options);
        break;

      case "java":
        result = await executeJava(options);
        break;

      case "python":
        result = await executePython(options);
        break;

      case "javascript":
        result = await executeJavaScript(options);
        break;

      case "typescript":
        result = await executeTypeScript(options);
        break;

      default:
        throw new Error(
          `Unsupported execution language: ${execution.language}`,
        );
    }

    // Atomically save the result only if execution is still running.
    const updateResult = await Execution.updateOne(
      {
        _id: executionId,
        status: "running",
      },
      {
        $set: {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          compilationTime: result.compilationTime,
          executionTime: result.executionTime,
          memoryUsed: result.memoryUsed,
          exitCode: result.exitCode,
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      const latestExecution =
        await Execution.findById(executionId).select("status");

      if (latestExecution?.status === "cancelling") {
        await markExecutionCancelled(executionId);
        return;
      }

      console.warn(
        `Execution ${executionId} result was not saved. Current status: ${latestExecution?.status}`,
      );

      return;
    }

    await releaseSlotSafely(execution.userId.toString(), executionId);

    console.log(
      `Execution ${executionId} finished with status: ${result.status}`,
    );
  } catch (error) {
    console.error(`Execution ${executionId} failed:`, error);

    // Check whether cancellation was requested.
    const latestExecution =
      await Execution.findById(executionId).select("status");

    if (!latestExecution) {
      throw error;
    }

    if (latestExecution.status === "cancelling") {
      await markExecutionCancelled(executionId);
      return;
    }

    // Ignore retry handling if execution is no longer running.
    if (latestExecution.status !== "running") {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isFinalAttempt) {
      const failureResult = await Execution.updateOne(
        { _id: executionId, status: "running" },
        {
          $set: {
            status: "internal_error",
            stderr: "Execution failed after maximum retry attempts",
          },
        },
      );

      if (failureResult.modifiedCount > 0) {
        await releaseSlotSafely(execution.userId.toString(), executionId);
      }

      return;
    }

    // Reset status so the next attempt can claim this execution.
    const resetResult = await Execution.updateOne(
      {
        _id: executionId,
        status: "running",
      },
      {
        $set: {
          status: "queued",
          stderr: "",
        },
      },
    );

    if (resetResult.modifiedCount === 0) {
      throw new Error(`Unable to reset execution ${executionId} for retry`);
    }

    // Important: rethrow so BullMQ activates its retry mechanism.
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
};

export const executionWorker = new Worker<ExecutionJobData>(
  EXECUTION_QUEUE_NAME,
  processExecution,
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

executionWorker.on("completed", (job) => {
  console.log(`Execution job completed: ${job.id}`);
});

executionWorker.on("failed", async (job, error) => {
  console.error(`Execution job failed: ${job?.id}`, error);

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  if (job.attemptsMade < maxAttempts) {
    return;
  }

  try {
    await Execution.updateOne(
      {
        _id: job.data.executionId,
        status: { $in: ["queued", "running"] },
      },
      {
        $set: {
          status: "internal_error",
          stderr: "Execution failed after maximum retry attempts",
        },
      },
    );

    console.error(`Execution ${job.data.executionId} marked as internal_error`);
  } catch (updateError) {
    console.error(
      "Failed to update execution after final job failure:",
      updateError,
    );
  }
});

executionWorker.on("error", (error) => {
  console.error("Execution worker error:", error);
});

executionWorker.on("failed", async (job, error) => {
  console.error(`Execution job ${job?.id} failed:`, error);

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;

  if (job.attemptsMade < maxAttempts) return;

  try {
    const failedExecution = await Execution.findOneAndUpdate(
      {
        _id: job.data.executionId,
        status: { $in: ["queued", "running"] },
      },
      {
        $set: {
          status: "internal_error",
          stderr: "Execution failed after maximum retry attempts",
        },
      },
      { new: true },
    ).select("userId");

    if (failedExecution) {
      await releaseSlotSafely(
        failedExecution.userId.toString(),
        job.data.executionId,
      );
    }
  } catch (updateError) {
    console.error(
      `Failed to finalize execution ${job.data.executionId}:`,
      updateError,
    );
  }
});

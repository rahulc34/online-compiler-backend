import { Worker, Job } from "bullmq";

import redisConnection from "../config/redis";
import Execution from "../models/execution.model";
import {
  EXECUTION_QUEUE_NAME,
  ExecutionJobData,
} from "../queues/execution.queue";
import { executeCpp } from "../services/cpp-execution.service";

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
      $set: { status: "running" },
    },
    {
      new: true,
    },
  );

  if (!execution) {
    console.log(`Execution ${executionId} is not queued or does not exist`);
    return;
  }

  try {
    let result;

    if (execution.language === "cpp") {
      result = await executeCpp({
        files: execution.files.map((file) => ({
          name: file.name,
          content: file.content,
        })),
        stdin: execution.stdin,
      });
    } else {
      result = {
        status: "internal_error" as const,
        stdout: "",
        stderr: `Execution for ${execution.language} is not implemented yet`,
        compilationTime: 0,
        executionTime: 0,
        exitCode: null,
      };
    }

    // Persist execution result.
    await Execution.updateOne(
      { _id: executionId, status: "running" },
      {
        $set: {
          status: result.status,
          stdout: result.stdout,
          stderr: result.stderr,
          compilationTime: result.compilationTime,
          executionTime: result.executionTime,
          exitCode: result.exitCode,
        },
      },
    );

    console.log(
      `Execution ${executionId} finished with status: ${result.status}`,
    );
  } catch (error) {
    console.error(`Execution ${executionId} failed:`, error);

    await Execution.updateOne(
      { _id: executionId, status: "running" },
      {
        $set: {
          status: "internal_error",
          stderr: "Internal execution error",
        },
      },
    );
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

executionWorker.on("failed", (job, error) => {
  console.error(`Execution job failed: ${job?.id}`, error);
});

executionWorker.on("error", (error) => {
  console.error("Execution worker error:", error);
});

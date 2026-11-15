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
    const files = execution.files.map((file) => ({
      name: file.name,
      content: file.content,
    }));

    const options = {
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

    // Persist execution result.
    await Execution.updateOne(
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

    console.log(
      `Execution ${executionId} finished with status: ${result.status}`,
    );
  } catch (error) {
    console.error(`Execution ${executionId} failed:`, error);

    await Execution.updateOne(
      {
        _id: executionId,
        status: "running",
      },
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

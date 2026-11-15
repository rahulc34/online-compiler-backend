import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export const EXECUTION_QUEUE_NAME = "execution-queue";

export interface ExecutionJobData {
  executionId: string;
}

export const executionQueue = new Queue<ExecutionJobData>(
  EXECUTION_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  },
);

import dotenv from "dotenv";
dotenv.config();

import connectDatabase from "./config/database";
import { config } from "./config";

import { startCancellationListener } from "./services/execution-cancellation.listener";
import { recoverStaleExecutions } from "./services/execution-recovery.service";
import { cleanupOrphanedContainers } from "./services/docker-cleanup.service";
import { recoverExecutionConcurrencySlots } from "./services/execution-concurrency-recovery.service";

const startWorker = async () => {
  await connectDatabase(config.database.uri);

  await recoverStaleExecutions();
  await cleanupOrphanedContainers();
  await recoverExecutionConcurrencySlots();

  await startCancellationListener();

  await import("./workers/execution.worker.js");

  console.log("Execution worker started successfully");
};

startWorker().catch((error) => {
  console.error("Failed to start execution worker:", error);
  process.exit(1);
});

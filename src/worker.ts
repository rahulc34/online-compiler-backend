import dotenv from "dotenv";
dotenv.config();

import connectDatabase from "./config/database";
import { config } from "./config";

import { startCancellationListener } from "./services/execution-cancellation.listener";
import { recoverStaleExecutions } from "./services/execution-recovery.service";
import { cleanupOrphanedContainers } from "./services/docker-cleanup.service";

const startWorker = async () => {
  await connectDatabase(config.database.uri);

  // Recover stale execution records first.
  await recoverStaleExecutions();

  // Remove containers belonging to stale or completed executions.
  await cleanupOrphanedContainers();

  // Start cancellation listener.
  await startCancellationListener();

  // Start BullMQ worker.
  await import("./workers/execution.worker.js");

  console.log("Execution worker started successfully");
};

startWorker().catch((error) => {
  console.error("Failed to start execution worker:", error);
  process.exit(1);
});

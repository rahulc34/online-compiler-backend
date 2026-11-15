import dotenv from "dotenv";
dotenv.config();

import connectDatabase from "./config/database";
import { config } from "./config";

import { startCancellationListener } from "./services/execution-cancellation.listener";
import { recoverStaleExecutions } from "./services/execution-recovery.service";

const startWorker = async () => {
  // 1. Connect to MongoDB.
  await connectDatabase(config.database.uri);

  // 2. Recover executions abandoned by previous workers.
  await recoverStaleExecutions();

  // 3. Start listening for cancellation requests.
  await startCancellationListener();

  // 4. Start the BullMQ execution worker.
  await import("./workers/execution.worker.js");

  console.log("Execution worker started successfully");
};

startWorker().catch((error) => {
  console.error("Failed to start execution worker:", error);
  process.exit(1);
});

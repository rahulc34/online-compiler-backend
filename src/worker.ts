import dotenv from "dotenv";
dotenv.config();

import connectDatabase from "./config/database";
import { config } from "./config";
import { startCancellationListener } from "./services/execution-cancellation.listener";

const startWorker = async () => {
  await connectDatabase(config.database.uri);

  await startCancellationListener();

  // Import only after MongoDB is connected.
  await import("./workers/execution.worker.js");

  console.log("Execution worker started successfully");
};

startWorker().catch((error) => {
  console.error("Failed to start execution worker:", error);
  process.exit(1);
});

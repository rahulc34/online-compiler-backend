import app from "./app";
import connectDatabase from "./config/database";
import { config } from "./config";

const startServer = async () => {
  await connectDatabase(config.database.uri);

  app.listen(config.port, "127.0.0.1", () => {
    console.log(`Compiler server running on port ${config.port}`);
  });
};

startServer();

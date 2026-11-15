import express from "express";
import cors from "cors";
import helmet from "helmet";

import { config } from "./config";
import notFound from "./middlewares/not-found";
import errorHandler from "./middlewares/error-handler";
import sessionMiddleware from "./config/session";
import passport from "./config/passport";

import authRoutes from "./modules/auth/auth.routes";
import executionRoutes from "./modules/execution/execution.routes";

const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: config.clientUrl || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(sessionMiddleware);
app.use(passport.initialize());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/executions", executionRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Compiler API is running",
    data: {
      timestamp: new Date().toISOString(),
    },
  });
});

// Register application routes above these two middleware.
app.use(notFound);
app.use(errorHandler);

export default app;

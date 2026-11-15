import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

import { createExecutionController } from "./execution.controller";
import { createExecutionSchema } from "./execution.validation";

const router = Router();

router.post(
  "/",
  requireAuth,
  validate(createExecutionSchema),
  createExecutionController,
);

export default router;

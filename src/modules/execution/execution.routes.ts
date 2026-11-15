import { Router } from "express";

import { requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

import {
  createExecutionController,
  getExecutionController,
} from "./execution.controller";
import { createExecutionSchema } from "./execution.validation";

const router = Router();

router.post(
  "/",
  requireAuth,
  validate(createExecutionSchema),
  createExecutionController,
);
router.get("/:executionId", requireAuth, getExecutionController);

export default router;

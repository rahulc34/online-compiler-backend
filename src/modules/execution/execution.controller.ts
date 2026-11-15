import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { createExecution } from "./execution.service";
import type { CreateExecutionInput } from "./execution.validation";

export const createExecutionController: RequestHandler = asyncHandler(
  async (req, res) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const input = req.body as CreateExecutionInput;

    const execution = await createExecution({
      userId: user._id.toString(),
      input,
    });

    res.status(202).json(
      new ApiResponse(202, "Execution job created successfully", {
        executionId: execution._id.toString(),
        status: execution.status,
        language: execution.language,
        createdAt: execution.createdAt,
      }),
    );
  },
);

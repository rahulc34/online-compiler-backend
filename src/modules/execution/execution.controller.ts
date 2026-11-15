import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { createExecution } from "./execution.service";
import type { CreateExecutionInput } from "./execution.validation";

import mongoose from "mongoose";
import Execution from "../../models/execution.model";

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

export const getExecutionController: RequestHandler = asyncHandler(
  async (req, res) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const { executionId } = req.params;

    if (!mongoose.isValidObjectId(executionId)) {
      throw new ApiError(400, "Invalid execution ID");
    }

    const execution = await Execution.findOne({
      _id: executionId,
      userId: user._id,
    }).select(
      "language status stdout stderr compilationTime executionTime memoryUsed exitCode createdAt updatedAt",
    );

    if (!execution) {
      throw new ApiError(404, "Execution not found");
    }

    res.status(200).json(
      new ApiResponse(200, "Execution fetched successfully", {
        executionId: execution._id.toString(),
        language: execution.language,
        status: execution.status,
        stdout: execution.stdout,
        stderr: execution.stderr,
        compilationTime: execution.compilationTime,
        executionTime: execution.executionTime,
        memoryUsed: execution.memoryUsed,
        exitCode: execution.exitCode,
        createdAt: execution.createdAt,
        updatedAt: execution.updatedAt,
      }),
    );
  },
);

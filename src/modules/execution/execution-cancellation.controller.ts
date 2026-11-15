import { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { cancelExecution } from "./execution-cancellation.service";

export const cancelExecutionController: RequestHandler = asyncHandler(
  async (req, res) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    const result = await cancelExecution({
      executionId: String(req.params.executionId),
      userId: user._id.toString(),
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Execution cancelled successfully", result));
  },
);

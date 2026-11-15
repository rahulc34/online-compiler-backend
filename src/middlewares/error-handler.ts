import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error";
import { ApiResponse } from "../utils/api-response";

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Custom application errors
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      statusCode: error.statusCode,
      message: error.message,
      errors: error.errors,
    });
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // MongoDB duplicate-key error
  if (error.code === 11000) {
    res.status(409).json({
      success: false,
      statusCode: 409,
      message: "A record with this value already exists",
      errors: error.keyValue ?? null,
    });
    return;
  }

  // Unexpected errors
  console.error("Unhandled error:", error);

  res.status(500).json(new ApiResponse(500, "Internal server error", null));
};

export default errorHandler;

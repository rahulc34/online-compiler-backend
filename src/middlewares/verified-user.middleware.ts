import { RequestHandler } from "express";
import { ApiError } from "../utils/api-error";

export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  if (!req.user.isEmailVerified) {
    return next(new ApiError(403, "Please verify your email address first"));
  }

  next();
};

import { RequestHandler } from "express";

import User from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

export const requireAuth: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const userId = req.session.userId;

    if (!userId) {
      throw new ApiError(401, "Authentication required");
    }

    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy(() => {});
      throw new ApiError(401, "Invalid session");
    }

    if (user.status === "banned") {
      req.session.destroy(() => {});
      throw new ApiError(403, "Your account has been suspended");
    }

    if (req.session.sessionVersion !== user.sessionVersion) {
      req.session.destroy(() => {});
      throw new ApiError(401, "Session expired. Please log in again.");
    }

    req.user = user;

    next();
  },
);

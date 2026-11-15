import { RequestHandler } from "express";
import { config } from "../config";
import redisConnection from "../config/redis";
import { ApiError } from "../utils/api-error";
import { asyncHandler } from "../utils/async-handler";

const WINDOW_SECONDS = 60;

const incrementScript = `
  local count = redis.call("INCR", KEYS[1])

  if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end

  return count
`;

export const executionRateLimiter: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const userId = req.user._id.toString();
    const key = `rate-limit:execution:${userId}`;

    const requestCount = (await redisConnection.eval(
      incrementScript,
      1,
      key,
      WINDOW_SECONDS,
    )) as number;

    if (requestCount > config.execution.maxRequestsPerMinute) {
      throw new ApiError(
        429,
        "Too many execution requests. Please try again later.",
      );
    }

    next();
  },
);

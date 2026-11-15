import redisConnection from "../config/redis";
import { config } from "../config";

const reserveScript = `
  if redis.call("SISMEMBER", KEYS[1], ARGV[1]) == 1 then
    return 1
  end

  local count = redis.call("SCARD", KEYS[1])

  if count >= tonumber(ARGV[2]) then
    return 0
  end

  redis.call("SADD", KEYS[1], ARGV[1])
  return 1
`;

export const reserveExecutionSlot = async (
  userId: string,
  executionId: string,
): Promise<boolean> => {
  const key = `execution:active:${userId}`;

  const result = await redisConnection.eval(
    reserveScript,
    1,
    key,
    executionId,
    config.execution.maxActivePerUser,
  );

  return Number(result) === 1;
};

export const releaseExecutionSlot = async (
  userId: string,
  executionId: string,
): Promise<void> => {
  const key = `execution:active:${userId}`;

  await redisConnection.srem(key, executionId);
};

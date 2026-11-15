import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const generatePasswordResetToken = (): string => {
  return randomBytes(32).toString("hex");
};

export const hashPasswordResetToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const comparePasswordResetToken = (
  token: string,
  storedHash: string,
): boolean => {
  const inputHash = Buffer.from(hashPasswordResetToken(token), "hex");
  const savedHash = Buffer.from(storedHash, "hex");

  if (inputHash.length !== savedHash.length) {
    return false;
  }

  return timingSafeEqual(inputHash, savedHash);
};

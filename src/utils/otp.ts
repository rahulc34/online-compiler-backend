import { createHmac, randomInt, timingSafeEqual } from "crypto";

import { config } from "../config";

const OTP_LENGTH = 6;

export const generateOtp = (): string => {
  return randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, "0");
};

export const hashOtp = (otp: string): string => {
  return createHmac("sha256", config.security.otpHashSecret)
    .update(otp)
    .digest("hex");
};

export const compareOtp = (otp: string, storedHash: string): boolean => {
  const inputHash = Buffer.from(hashOtp(otp), "hex");
  const savedHash = Buffer.from(storedHash, "hex");

  if (inputHash.length !== savedHash.length) {
    return false;
  }

  return timingSafeEqual(inputHash, savedHash);
};

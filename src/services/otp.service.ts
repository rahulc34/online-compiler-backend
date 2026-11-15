import Otp from "../models/otp.model";
import User from "../models/user.model";

import { generateOtp, hashOtp, compareOtp } from "../utils/otp";
import { ApiError } from "../utils/api-error";
import { sendMail } from "./mail.service";

import { verificationOtpTemplate } from "../templates/emails/verification-otp.template";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const OTP_PURPOSE = "email_verification" as const;

interface CreateOtpOptions {
  userId: string;
  name: string;
  email: string;
}

export const createEmailVerificationOtp = async ({
  userId,
  name,
  email,
}: CreateOtpOptions): Promise<void> => {
  const now = new Date();

  const existingOtp = await Otp.findOne({
    userId,
    purpose: OTP_PURPOSE,
  });

  if (
    existingOtp &&
    now.getTime() - existingOtp.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    throw new ApiError(429, "Please wait before requesting another OTP");
  }

  const otp = generateOtp();

  await Otp.findOneAndUpdate(
    {
      userId,
      purpose: OTP_PURPOSE,
    },
    {
      $set: {
        otpHash: hashOtp(otp),
        expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),
        attempts: 0,
        lastSentAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    },
  );

  try {
    await sendMail({
      to: email,
      subject: "Verify your Compiler account",
      html: verificationOtpTemplate({
        name,
        otp,
      }),
      text: `Your Compiler verification code is ${otp}. It expires in 5 minutes.`,
    });
  } catch (error) {
    // Do not leave an OTP active when its email could not be sent.
    await Otp.deleteOne({
      userId,
      purpose: OTP_PURPOSE,
    });

    throw error;
  }
};

export const verifyEmailOtp = async (
  userId: string,
  enteredOtp: string,
): Promise<void> => {
  const existingOtp = await Otp.findOne({
    userId,
    purpose: OTP_PURPOSE,
  }).select("+otpHash");

  if (!existingOtp) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  const now = new Date();

  if (existingOtp.expiresAt <= now) {
    await Otp.deleteOne({ _id: existingOtp._id });
    throw new ApiError(400, "OTP has expired");
  }

  if (existingOtp.attempts >= MAX_OTP_ATTEMPTS) {
    throw new ApiError(
      429,
      "Maximum OTP attempts exceeded. Request a new OTP.",
    );
  }

  // Atomically consume one verification attempt.
  const otpRecord = await Otp.findOneAndUpdate(
    {
      _id: existingOtp._id,
      attempts: { $lt: MAX_OTP_ATTEMPTS },
      expiresAt: { $gt: now },
    },
    {
      $inc: { attempts: 1 },
    },
    {
      returnDocument: "after",
    },
  ).select("+otpHash");

  if (!otpRecord) {
    throw new ApiError(
      429,
      "Maximum OTP attempts exceeded. Request a new OTP.",
    );
  }

  const isValid = compareOtp(enteredOtp, otpRecord.otpHash);

  if (!isValid) {
    throw new ApiError(400, "Invalid OTP");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isEmailVerified) {
    await Otp.deleteOne({ _id: otpRecord._id });
    return;
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();

  await user.save();

  await Otp.deleteOne({ _id: otpRecord._id });
};

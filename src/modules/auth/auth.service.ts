import { config } from "../../config";
import User from "../../models/user.model";
import PasswordResetToken from "../../models/password-reset-token.model";
import { hashPassword, comparePassword } from "../../utils/password";
import { ApiError } from "../../utils/api-error";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  comparePasswordResetToken,
} from "../../utils/password-reset";
import { passwordResetTemplate } from "../../templates/emails/password-reset.template";
import { createEmailVerificationOtp } from "../../services/otp.service";
import { sendMail } from "../../services/mail.service";
import type {
  SignupInput,
  LoginInput,
  ResetPasswordInput,
} from "./auth.validation";

interface SignupResult {
  id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
}

interface LoginResult {
  id: string;
  name: string;
  email: string;
  role: string;
  sessionVersion: number;
}

export const signupUser = async (input: SignupInput): Promise<SignupResult> => {
  const { name, email, password } = input;

  // bcrypt supports a maximum of 72 UTF-8 bytes.
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(400, "Password cannot exceed 72 bytes");
  }

  // Check whether the email is already registered.
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(409, "Email is already registered");
  }

  // Hash the password before storing it.
  const passwordHash = await hashPassword(password);

  // Create the user.
  const user = await User.create({
    name,
    email,
    passwordHash,
  });

  try {
    // Send the email verification OTP.
    await createEmailVerificationOtp({
      userId: user.id,
      name: user.name,
      email: user.email,
    });
  } catch {
    // Roll back the newly created account if OTP delivery fails.
    await User.deleteOne({ _id: user._id });
    throw new ApiError(
      503,
      "Unable to send verification email. Please try again.",
    );
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
  };
};

export const resendVerificationOtp = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  await createEmailVerificationOtp({
    userId: user.id,
    name: user.name,
    email: user.email,
  });
};

export const loginUser = async (input: LoginInput): Promise<LoginResult> => {
  const { email, password } = input;

  // Retrieve passwordHash because the field has select: false.
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !user.passwordHash) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status === "banned") {
    throw new ApiError(403, "Your account has been suspended");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(403, "Please verify your email before logging in");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email }).select("+passwordHash");

  // Use the same response for unknown and OAuth-only accounts.
  if (!user || !user.passwordHash) {
    return;
  }

  const token = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Create or replace the user's existing reset token.
  const resetToken = await PasswordResetToken.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        tokenHash,
        expiresAt,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const resetUrl = new URL("/reset-password", config.clientUrl);
  resetUrl.searchParams.set("token", token);

  try {
    await sendMail({
      to: user.email,
      subject: "Reset your Compiler password",
      html: passwordResetTemplate({
        name: user.name,
        resetUrl: resetUrl.toString(),
      }),
      text: `Reset your password using this link: ${resetUrl.toString()}. The link expires in 15 minutes.`,
    });
  } catch {
    // Delete only the token created by this request.
    await PasswordResetToken.deleteOne({
      _id: resetToken._id,
      tokenHash,
    });

    throw new ApiError(
      503,
      "Unable to send password reset email. Please try again.",
    );
  }
};

export const resetPassword = async (
  input: ResetPasswordInput,
): Promise<void> => {
  const { token, password } = input;

  // bcrypt has a 72-byte limit.
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new ApiError(400, "Password cannot exceed 72 bytes");
  }

  const tokenHash = hashPasswordResetToken(token);

  // Retrieve the stored hash explicitly.
  const resetRecord = await PasswordResetToken.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");

  if (!resetRecord) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const isValid = comparePasswordResetToken(token, resetRecord.tokenHash);

  if (!isValid) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  // Atomically consume the token so it cannot be reused.
  const consumedToken = await PasswordResetToken.findOneAndDelete({
    _id: resetRecord._id,
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!consumedToken) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(password);

  const user = await User.findByIdAndUpdate(
    resetRecord.userId,
    {
      $set: { passwordHash },
      $inc: { sessionVersion: 1 },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Invalidate any other outstanding reset token for this user.
  await PasswordResetToken.deleteMany({
    userId: resetRecord.userId,
  });
};

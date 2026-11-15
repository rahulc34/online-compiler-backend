import { z } from "zod";

// Signup
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),
});

// Login
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required")
    .max(72, "Invalid password"),
});

// Verify email OTP
export const verifyEmailOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),

  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});

// Resend email OTP
export const resendEmailOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .length(64, "Invalid or expired reset token")
      .regex(/^[a-f0-9]{64}$/, "Invalid or expired reset token"),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(72, "Password cannot exceed 72 characters"),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Export inferred TypeScript types
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;
export type ResendEmailOtpInput = z.infer<typeof resendEmailOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

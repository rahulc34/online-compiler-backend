import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  CLIENT_URL: z.string().url().default("http://localhost:5173"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  OTP_HASH_SECRET: z
    .string()
    .min(32, "OTP_HASH_SECRET must be at least 32 characters"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

export const loadEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      result.error.flatten().fieldErrors,
    );

    process.exit(1);
  }

  return result.data;
};

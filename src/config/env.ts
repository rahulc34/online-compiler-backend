import { z } from "zod";
import "dotenv/config";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

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

  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().optional()),

  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  GOOGLE_CALLBACK_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),

  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),

  SMTP_PORT: z.coerce.number().int().positive().default(587),

  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),

  SMTP_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),

  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().email().optional()),

  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),

  MAX_ACTIVE_EXECUTIONS_PER_USER: z.coerce.number().int().positive().default(2),
  MAX_EXECUTION_REQUESTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
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

import { loadEnv } from "./env";

const env = loadEnv();

export const config = {
  env: env.NODE_ENV,

  port: env.PORT,

  clientUrl: env.CLIENT_URL,

  database: {
    uri: env.MONGODB_URI,
  },

  isDevelopment: env.NODE_ENV === "development",

  isProduction: env.NODE_ENV === "production",

  session: {
    secret: env.SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  security: {
    otpHashSecret: env.OTP_HASH_SECRET,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL,
  },

  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: env.EMAIL_FROM,
  },

  redis: {
    url: env.REDIS_URL,
  },
};

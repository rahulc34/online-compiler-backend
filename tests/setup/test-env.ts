process.env.NODE_ENV = "test";
process.env.PORT = "5001";
process.env.CLIENT_URL = "http://localhost:5173";

process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/compiler_test";

process.env.SESSION_SECRET =
  "test-session-secret-that-is-at-least-32-characters";

process.env.OTP_HASH_SECRET = "test-otp-secret-that-is-at-least-32-characters";

process.env.SMTP_HOST = "";
process.env.SMTP_PORT = "587";
process.env.SMTP_SECURE = "false";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.EMAIL_FROM = "test@example.com";

process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.GOOGLE_CALLBACK_URL = "";

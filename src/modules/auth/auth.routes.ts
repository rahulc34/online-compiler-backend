import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { requireAuth } from "../../middlewares/auth.middleware";

import {
  signupController,
  verifyEmailOtpController,
  resendEmailOtpController,
  loginController,
  logoutController,
  getCurrentUserController,
  forgotPasswordController,
  resetPasswordController,
  googleAuthController,
  googleCallbackController,
} from "./auth.controller";
import {
  signupSchema,
  verifyEmailOtpSchema,
  resendEmailOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.validation";

import { authRateLimiter } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.use(authRateLimiter);

router.post("/signup", validate(signupSchema), signupController);
router.post(
  "/verify-email",
  validate(verifyEmailOtpSchema),
  verifyEmailOtpController,
);
router.post(
  "/resend-otp",
  validate(resendEmailOtpSchema),
  resendEmailOtpController,
);
router.post("/login", validate(loginSchema), loginController);
router.post("/logout", requireAuth, logoutController);
router.get("/me", requireAuth, getCurrentUserController);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPasswordController,
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPasswordController,
);
router.get("/google", googleAuthController);
router.get("/google/callback", googleCallbackController);

export default router;

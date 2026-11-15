import { RequestHandler } from "express";
import { config } from "../../config";
import passport from "../../config/passport";
import User from "../../models/user.model";
import type { IUser } from "../../models/user.model";

import { ApiError } from "../../utils/api-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";

import type {
  VerifyEmailOtpInput,
  ResendEmailOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./auth.validation";

import {
  signupUser,
  resendVerificationOtp,
  loginUser,
  forgotPassword,
  resetPassword,
} from "./auth.service";
import { verifyEmailOtp } from "../../services/otp.service";

export const signupController: RequestHandler = asyncHandler(
  async (req, res) => {
    const result = await signupUser(req.body);

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          "Account created. Please verify your email.",
          result,
        ),
      );
  },
);

export const verifyEmailOtpController: RequestHandler = asyncHandler(
  async (req, res) => {
    const { email, otp } = req.body as VerifyEmailOtpInput;

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isEmailVerified) {
      throw new ApiError(400, "Email is already verified");
    }

    await verifyEmailOtp(user.id, otp);

    res
      .status(200)
      .json(new ApiResponse(200, "Email verified successfully", null));
  },
);

export const resendEmailOtpController: RequestHandler = asyncHandler(
  async (req, res) => {
    const { email } = req.body as ResendEmailOtpInput;

    await resendVerificationOtp(email);

    res
      .status(200)
      .json(new ApiResponse(200, "Verification OTP sent successfully", null));
  },
);

export const loginController: RequestHandler = asyncHandler(
  async (req, res) => {
    const { email, password } = req.body;

    const user = await loginUser({ email, password });

    // Regenerate the session ID to prevent session fixation.
    req.session.regenerate((error) => {
      if (error) {
        return res
          .status(500)
          .json(new ApiResponse(500, "Unable to create session", null));
      }

      req.session.userId = user.id;
      req.session.sessionVersion = user.sessionVersion;

      req.session.save((saveError) => {
        if (saveError) {
          return res
            .status(500)
            .json(new ApiResponse(500, "Unable to save session", null));
        }

        return res
          .status(200)
          .json(new ApiResponse(200, "Login successful", user));
      });
    });
  },
);

export const logoutController: RequestHandler = asyncHandler(
  async (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res
          .status(500)
          .json(new ApiResponse(500, "Unable to logout", null));
      }

      res.clearCookie("compiler.sid", {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
      });

      return res
        .status(200)
        .json(new ApiResponse(200, "Logout successful", null));
    });
  },
);

export const getCurrentUserController: RequestHandler = asyncHandler(
  async (req, res) => {
    const user = req.user;

    if (!user) {
      throw new ApiError(401, "Authentication required");
    }

    res.status(200).json(
      new ApiResponse(200, "User profile fetched successfully", {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      }),
    );
  },
);

export const forgotPasswordController: RequestHandler = asyncHandler(
  async (req, res) => {
    const { email } = req.body as ForgotPasswordInput;

    await forgotPassword(email);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "If an account exists with this email, a password reset link will be sent.",
          null,
        ),
      );
  },
);

export const resetPasswordController: RequestHandler = asyncHandler(
  async (req, res) => {
    const input = req.body as ResetPasswordInput;

    await resetPassword(input);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Password reset successfully. Please log in again.",
          null,
        ),
      );
  },
);

export const googleAuthController: RequestHandler = (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })(req, res, next);
};

export const googleCallbackController: RequestHandler = (req, res, next) => {
  passport.authenticate(
    "google",
    { session: false },
    (error: Error | null, user: Express.User | false) => {
      if (error || !user) {
        return res.redirect(
          `${config.clientUrl}/login?error=google_auth_failed`,
        );
      }

      req.session.regenerate((sessionError) => {
        if (sessionError) {
          return res.redirect(`${config.clientUrl}/login?error=session_failed`);
        }

        const authenticatedUser = user as IUser;

        req.session.userId = authenticatedUser._id.toString();
        req.session.sessionVersion = authenticatedUser.sessionVersion;

        req.session.save((saveError) => {
          if (saveError) {
            return res.redirect(
              `${config.clientUrl}/login?error=session_failed`,
            );
          }

          return res.redirect(`${config.clientUrl}/`);
        });
      });
    },
  )(req, res, next);
};

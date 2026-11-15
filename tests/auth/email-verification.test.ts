import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";
import Otp from "../../src/models/otp.model";
import { hashOtp } from "../../src/utils/otp";

describe("POST /api/v1/auth/verify-email", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.verify@example.com",
    password: "StrongPassword123",
  };

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const registerUser = async () => {
    await request(app).post("/api/v1/auth/signup").send(signupData);

    return User.findOne({ email: signupData.email });
  };

  const getOtpFromEmail = (): string => {
    const email = mockSendMail.mock.calls[0][0];

    const match = email.html.match(/\b\d{6}\b/);

    if (!match) {
      throw new Error("OTP not found in mocked email");
    }

    return match[0];
  };

  it("should verify email with correct OTP", async () => {
    await registerUser();

    const otp = getOtpFromEmail();

    const response = await request(app).post("/api/v1/auth/verify-email").send({
      email: signupData.email,
      otp,
    });

    expect(response.status).toBe(200);

    const user = await User.findOne({ email: signupData.email });

    expect(user?.isEmailVerified).toBe(true);
    expect(user?.emailVerifiedAt).toBeDefined();

    const otpRecord = await Otp.findOne({
      userId: user?._id,
      purpose: "email_verification",
    });

    expect(otpRecord).toBeNull();
  });

  it("should reject an incorrect OTP", async () => {
    await registerUser();

    const response = await request(app).post("/api/v1/auth/verify-email").send({
      email: signupData.email,
      otp: "000000",
    });

    expect(response.status).toBe(400);

    const user = await User.findOne({ email: signupData.email });

    expect(user?.isEmailVerified).toBe(false);
  });

  it("should reject an expired OTP", async () => {
    const user = await registerUser();

    const otp = getOtpFromEmail();

    await Otp.findOneAndUpdate(
      {
        userId: user?._id,
        purpose: "email_verification",
      },
      {
        $set: {
          expiresAt: new Date(Date.now() - 60_000),
        },
      },
    );

    const response = await request(app).post("/api/v1/auth/verify-email").send({
      email: signupData.email,
      otp,
    });

    expect(response.status).toBe(400);

    const updatedUser = await User.findOne({
      email: signupData.email,
    });

    expect(updatedUser?.isEmailVerified).toBe(false);
  });

  it("should reject verification for an already verified user", async () => {
    const user = await registerUser();

    const otp = getOtpFromEmail();

    await User.findByIdAndUpdate(user?._id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    const response = await request(app).post("/api/v1/auth/verify-email").send({
      email: signupData.email,
      otp,
    });

    expect(response.status).toBe(400);
  });
});

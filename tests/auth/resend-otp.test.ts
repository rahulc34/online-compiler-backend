import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";
import Otp from "../../src/models/otp.model";

describe("POST /api/v1/auth/resend-otp", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.resend@example.com",
    password: "StrongPassword123",
  };

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const registerUser = async () => {
    await request(app).post("/api/v1/auth/signup").send(signupData);

    return User.findOne({ email: signupData.email });
  };

  const getOtpFromEmail = (index: number): string => {
    const email = mockSendMail.mock.calls[index][0];
    const match = email.html.match(/\b\d{6}\b/);

    if (!match) {
      throw new Error("OTP not found in mocked email");
    }

    return match[0];
  };

  it("should resend OTP successfully", async () => {
    const user = await registerUser();

    const oldOtp = getOtpFromEmail(0);

    // Simulate the cooldown having elapsed.
    await Otp.findOneAndUpdate(
      {
        userId: user?._id,
        purpose: "email_verification",
      },
      {
        $set: {
          lastSentAt: new Date(Date.now() - 61_000),
        },
      },
    );

    const response = await request(app)
      .post("/api/v1/auth/resend-otp")
      .send({ email: signupData.email });

    expect(response.status).toBe(200);
    expect(mockSendMail).toHaveBeenCalledTimes(2);

    const newOtp = getOtpFromEmail(1);

    expect(newOtp).not.toBe(oldOtp);

    const otpRecord = await Otp.findOne({
      userId: user?._id,
      purpose: "email_verification",
    }).select("+otpHash");

    expect(otpRecord).not.toBeNull();
  });

  it("should reject resend during cooldown", async () => {
    await registerUser();

    const response = await request(app)
      .post("/api/v1/auth/resend-otp")
      .send({ email: signupData.email });

    expect(response.status).toBe(429);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("should reject resend for an already verified account", async () => {
    const user = await registerUser();

    await User.findByIdAndUpdate(user?._id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/api/v1/auth/resend-otp")
      .send({ email: signupData.email });

    expect(response.status).toBe(400);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("should reject resend for a nonexistent email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/resend-otp")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(404);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

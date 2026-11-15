import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash } from "crypto";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";
import PasswordResetToken from "../../src/models/password-reset-token.model";

describe("POST /api/v1/auth/reset-password", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.reset@example.com",
    password: "StrongPassword123",
  };

  const newPassword = "NewStrongPassword123";

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const createUser = async () => {
    await request(app).post("/api/v1/auth/signup").send(signupData);

    const user = await User.findOne({
      email: signupData.email,
    });

    if (!user) {
      throw new Error("Test user was not created");
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    return user;
  };

  const createResetToken = async (userId: unknown, expiresAt?: Date) => {
    const rawToken = "a".repeat(64);

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await PasswordResetToken.create({
      userId,
      tokenHash,
      expiresAt: expiresAt ?? new Date(Date.now() + 15 * 60 * 1000),
    });

    return rawToken;
  };

  it("should reset password successfully with a valid token", async () => {
    const user = await createUser();
    const token = await createResetToken(user._id);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token,
        password: newPassword,
        confirmPassword: newPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: newPassword,
    });

    expect(loginResponse.status).toBe(200);
  });

  it("should reject an invalid token", async () => {
    await createUser();

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: "b".repeat(64),
        password: newPassword,
        confirmPassword: newPassword,
      });

    expect(response.status).toBe(400);
  });

  it("should reject an expired token", async () => {
    const user = await createUser();

    const token = await createResetToken(
      user._id,
      new Date(Date.now() - 60_000),
    );

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token,
        password: newPassword,
        confirmPassword: newPassword,
      });

    expect(response.status).toBe(400);
  });

  it("should reject a token that has already been used", async () => {
    const user = await createUser();
    const token = await createResetToken(user._id);

    const payload = {
      token,
      password: newPassword,
      confirmPassword: newPassword,
    };

    const firstResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send(payload);

    expect(firstResponse.status).toBe(200);

    const secondResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send(payload);

    expect(secondResponse.status).toBe(400);
  });

  it("should reject mismatched passwords", async () => {
    const user = await createUser();
    const token = await createResetToken(user._id);

    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token,
        password: newPassword,
        confirmPassword: "DifferentPassword123",
      });

    expect(response.status).toBe(400);
  });

  it("should invalidate existing sessions after password reset", async () => {
    const user = await createUser();

    const agent = request.agent(app);

    const loginResponse = await agent.post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    expect(loginResponse.status).toBe(200);

    const token = await createResetToken(user._id);

    const resetResponse = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token,
        password: newPassword,
        confirmPassword: newPassword,
      });

    expect(resetResponse.status).toBe(200);

    const meResponse = await agent.get("/api/v1/auth/me");

    expect(meResponse.status).toBe(401);
  });
});

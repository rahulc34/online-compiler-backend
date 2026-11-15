import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";

describe("POST /api/v1/auth/login", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.login@example.com",
    password: "StrongPassword123",
  };

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const createUser = async (
    options: {
      isEmailVerified?: boolean;
      status?: "active" | "banned";
    } = {},
  ) => {
    await request(app).post("/api/v1/auth/signup").send(signupData);

    const user = await User.findOne({
      email: signupData.email,
    }).select("+passwordHash");

    if (!user) {
      throw new Error("Test user was not created");
    }

    user.isEmailVerified = options.isEmailVerified ?? true;
    user.status = options.status ?? "active";

    if (user.isEmailVerified) {
      user.emailVerifiedAt = new Date();
    }

    await user.save();

    return user;
  };

  it("should login successfully with verified email", async () => {
    await createUser();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.headers["set-cookie"]).toBeDefined();

    const cookies = response.headers["set-cookie"] as string[];

    expect(cookies.some((cookie) => cookie.startsWith("compiler.sid="))).toBe(
      true,
    );

    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("should reject an incorrect password", async () => {
    await createUser();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: "WrongPassword123",
    });

    expect(response.status).toBe(401);
  });

  it("should reject login for a nonexistent email", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "unknown@example.com",
      password: signupData.password,
    });

    expect(response.status).toBe(401);
  });

  it("should reject login when email is not verified", async () => {
    await createUser({
      isEmailVerified: false,
    });

    const response = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    expect(response.status).toBe(403);
  });

  it("should reject login for a banned user", async () => {
    await createUser({
      isEmailVerified: true,
      status: "banned",
    });

    const response = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    expect(response.status).toBe(403);
  });

  it("should update lastLoginAt after successful login", async () => {
    await createUser();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    expect(response.status).toBe(200);

    const user = await User.findOne({
      email: signupData.email,
    });

    expect(user?.lastLoginAt).toBeInstanceOf(Date);
  });
});

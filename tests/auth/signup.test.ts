import { describe, it, expect } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";
import User from "../../src/models/user.model";

describe("POST /api/v1/auth/signup", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.test@example.com",
    password: "StrongPassword123",
  };

  it("should register a new user successfully", async () => {
    const response = await request(app)
      .post("/api/v1/auth/signup")
      .send(signupData);

    expect(response.status).toBe(201);

    const user = await User.findOne({
      email: signupData.email,
    });

    expect(user).not.toBeNull();
    expect(user?.name).toBe(signupData.name);
    expect(user?.isEmailVerified).toBe(false);
    expect(user?.passwordHash).toBeUndefined();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("should reject duplicate email registration", async () => {
    await User.create({
      name: signupData.name,
      email: signupData.email,
      passwordHash: "existing-password-hash",
    });

    const response = await request(app)
      .post("/api/v1/auth/signup")
      .send(signupData);

    expect(response.status).toBe(409);

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("should reject invalid signup data", async () => {
    const response = await request(app).post("/api/v1/auth/signup").send({
      name: "R",
      email: "invalid-email",
      password: "123",
    });

    expect(response.status).toBe(400);

    const userCount = await User.countDocuments();

    expect(userCount).toBe(0);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

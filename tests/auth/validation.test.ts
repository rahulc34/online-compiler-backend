import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../helpers/test-app";

describe("Authentication request validation", () => {
  it("should reject signup with an invalid email", async () => {
    const response = await request(app).post("/api/v1/auth/signup").send({
      name: "Rahul",
      email: "invalid-email",
      password: "StrongPassword123",
    });

    expect(response.status).toBe(400);
  });

  it("should reject signup with a short password", async () => {
    const response = await request(app).post("/api/v1/auth/signup").send({
      name: "Rahul",
      email: "rahul.validation@example.com",
      password: "123",
    });

    expect(response.status).toBe(400);
  });

  it("should reject login with missing fields", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: "rahul.validation@example.com",
    });

    expect(response.status).toBe(400);
  });

  it("should reject email verification with an invalid OTP format", async () => {
    const response = await request(app).post("/api/v1/auth/verify-email").send({
      email: "rahul.validation@example.com",
      otp: "123",
    });

    expect(response.status).toBe(400);
  });

  it("should reject forgot-password with an invalid email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({
        email: "invalid-email",
      });

    expect(response.status).toBe(400);
  });

  it("should reject reset-password with mismatched passwords", async () => {
    const response = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({
        token: "a".repeat(64),
        password: "StrongPassword123",
        confirmPassword: "DifferentPassword123",
      });

    expect(response.status).toBe(400);
  });
});

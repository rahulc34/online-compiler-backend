import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";

describe("POST /api/v1/auth/forgot-password", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.forgot@example.com",
    password: "StrongPassword123",
  };

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const createUser = async () => {
    await request(app).post("/api/v1/auth/signup").send(signupData);

    return User.findOne({ email: signupData.email });
  };

  it("should send a password reset email for an existing account", async () => {
    await createUser();

    // Signup sends the first email (verification OTP).
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: signupData.email });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Signup email + password reset email.
    expect(mockSendMail).toHaveBeenCalledTimes(2);

    const email = mockSendMail.mock.calls[1][0];

    expect(email.to).toBe(signupData.email);
    expect(email.subject.toLowerCase()).toContain("reset");
    expect(email.html.toLowerCase()).toContain("reset");
  });

  it("should return a successful response for a nonexistent email", async () => {
    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("should not send a reset email for an OAuth-only account", async () => {
    await User.create({
      name: "Google User",
      email: "google.user@example.com",
      googleId: "google-test-id",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    const response = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "google.user@example.com" });

    expect(response.status).toBe(200);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("should return the same response for existing and nonexistent emails", async () => {
    await createUser();

    const existingResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: signupData.email });

    const unknownResponse = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });

    expect(existingResponse.status).toBe(unknownResponse.status);
    expect(existingResponse.body.message).toBe(unknownResponse.body.message);
  });
});

import { describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";

describe("POST /api/v1/auth/logout", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.logout@example.com",
    password: "StrongPassword123",
  };

  const createAuthenticatedAgent = async () => {
    mockSendMail.mockClear();

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

    const agent = request.agent(app);

    const loginResponse = await agent.post("/api/v1/auth/login").send({
      email: signupData.email,
      password: signupData.password,
    });

    if (loginResponse.status !== 200) {
      throw new Error("Test login failed");
    }

    return agent;
  };

  it("should logout successfully", async () => {
    const agent = await createAuthenticatedAgent();

    const response = await agent.post("/api/v1/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("should clear the session cookie after logout", async () => {
    const agent = await createAuthenticatedAgent();

    const response = await agent.post("/api/v1/auth/logout");

    expect(response.status).toBe(200);

    const cookies = response.headers["set-cookie"] as string[];

    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith("compiler.sid=") && /expires=/i.test(cookie),
      ),
    ).toBe(true);
  });

  it("should prevent access to protected routes after logout", async () => {
    const agent = await createAuthenticatedAgent();

    const logoutResponse = await agent.post("/api/v1/auth/logout");

    expect(logoutResponse.status).toBe(200);

    const meResponse = await agent.get("/api/v1/auth/me");

    expect(meResponse.status).toBe(401);
  });

  it("should reject logout without authentication", async () => {
    const response = await request(app).post("/api/v1/auth/logout");

    expect(response.status).toBe(401);
  });
});

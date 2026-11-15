
import { describe, expect, it } from "vitest";
import request from "supertest";

import { mockSendMail } from "../helpers/mock-email";
import app from "../helpers/test-app";

import User from "../../src/models/user.model";

describe("GET /api/v1/auth/me", () => {
  const signupData = {
    name: "Rahul Chaurasiya",
    email: "rahul.me@example.com",
    password: "StrongPassword123",
  };

  const createAuthenticatedAgent = async () => {
    mockSendMail.mockClear();

    await request(app)
      .post("/api/v1/auth/signup")
      .send(signupData);

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

    const loginResponse = await agent
      .post("/api/v1/auth/login")
      .send({
        email: signupData.email,
        password: signupData.password,
      });

    if (loginResponse.status !== 200) {
      throw new Error("Test login failed");
    }

    return { agent, user };
  };

  it("should return the authenticated user's details", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get("/api/v1/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const responseText = JSON.stringify(response.body);

    expect(responseText).toContain(signupData.email);
    expect(responseText).toContain(signupData.name);
  });

  it("should reject requests without authentication", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });

  it("should not expose sensitive user fields", async () => {
    const { agent } = await createAuthenticatedAgent();

    const response = await agent.get("/api/v1/auth/me");

    expect(response.status).toBe(200);

    const responseText = JSON.stringify(response.body);

    expect(responseText).not.toContain("passwordHash");
    expect(responseText).not.toContain("googleId");
    expect(responseText).not.toContain("sessionVersion");
  });

  it("should reject access after session revocation", async () => {
    const { agent, user } = await createAuthenticatedAgent();

    await User.findByIdAndUpdate(user._id, {
      $inc: { sessionVersion: 1 },
    });

    const response = await agent.get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });
});

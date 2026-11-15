import { describe, expect, it } from "vitest";
import request from "supertest";

import app from "../helpers/test-app";

describe("Authentication rate limiting", () => {
  it("should allow requests within the rate limit and reject requests beyond it", async () => {
    const responses = [];

    for (let i = 0; i < 21; i++) {
      const response = await request(app).post("/api/v1/auth/login").send({
        email: "unknown@example.com",
        password: "StrongPassword123",
      });

      responses.push(response);
    }

    // First 20 requests should reach the login controller.
    for (let i = 0; i < 20; i++) {
      expect(responses[i].status).toBe(401);
    }

    // Request 21 should be rate limited.
    expect(responses[20].status).toBe(429);
  });
});

import type { AuthUserResponse, LoginResponse } from "@ebookstore/contracts";
import { describe, expect, it } from "vitest";

import { createAuthSession } from "./auth-session";

const user: AuthUserResponse = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

function createLoginResponse(accessToken: string): LoginResponse {
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user,
  };
}

describe("createAuthSession", () => {
  it("creates an in-memory session with a normalized token", () => {
    expect(createAuthSession(createLoginResponse(" signed.jwt.token "))).toEqual({
      accessToken: "signed.jwt.token",
      user,
    });
  });

  it("rejects an empty access token", () => {
    expect(() => createAuthSession(createLoginResponse("   "))).toThrow(
      "Access token must not be empty.",
    );
  });
});

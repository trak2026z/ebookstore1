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

function createLoginResponse({
  accessToken = "signed.jwt.token",
  expiresIn = 900,
}: {
  readonly accessToken?: string;
  readonly expiresIn?: number;
} = {}): LoginResponse {
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn,
    user,
  };
}

describe("createAuthSession", () => {
  it("creates an in-memory session with a normalized token and expiry timestamp", () => {
    expect(
      createAuthSession(
        createLoginResponse({
          accessToken: " signed.jwt.token ",
        }),
        1_000,
      ),
    ).toEqual({
      accessToken: "signed.jwt.token",
      user,
      expiresAt: 901_000,
    });
  });

  it("rejects an empty access token", () => {
    expect(() =>
      createAuthSession(
        createLoginResponse({
          accessToken: "   ",
        }),
      ),
    ).toThrow("Access token must not be empty.");
  });

  it("rejects invalid session lifetimes", () => {
    for (const expiresIn of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createAuthSession(
          createLoginResponse({
            expiresIn,
          }),
          1_000,
        ),
      ).toThrow("Session lifetime must be a positive integer.");
    }
  });

  it("rejects an unsafe expiry timestamp", () => {
    expect(() =>
      createAuthSession(
        createLoginResponse({
          expiresIn: 1,
        }),
        Number.MAX_SAFE_INTEGER,
      ),
    ).toThrow("Session expiry timestamp is invalid.");
  });
});

import type { AuthUserResponse, LoginResponse } from "@ebookstore/contracts";

const MILLISECONDS_PER_SECOND = 1_000;

export interface AuthSession {
  readonly accessToken: string;
  readonly user: AuthUserResponse;
  readonly expiresAt: number;
}

function createExpiryTimestamp(expiresIn: number, now: number): number {
  if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
    throw new TypeError("Session lifetime must be a positive integer.");
  }

  if (!Number.isSafeInteger(now)) {
    throw new TypeError("Current timestamp must be a safe integer.");
  }

  const expiresAt = now + expiresIn * MILLISECONDS_PER_SECOND;

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    throw new TypeError("Session expiry timestamp is invalid.");
  }

  return expiresAt;
}

export function createAuthSession(response: LoginResponse, now = Date.now()): AuthSession {
  const accessToken = response.accessToken.trim();

  if (!accessToken) {
    throw new TypeError("Access token must not be empty.");
  }

  return {
    accessToken,
    user: response.user,
    expiresAt: createExpiryTimestamp(response.expiresIn, now),
  };
}

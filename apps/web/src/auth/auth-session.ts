import type { AuthUserResponse, LoginResponse } from "@ebookstore/contracts";

export interface AuthSession {
  readonly accessToken: string;
  readonly user: AuthUserResponse;
}

export function createAuthSession(response: LoginResponse): AuthSession {
  const accessToken = response.accessToken.trim();

  if (!accessToken) {
    throw new TypeError("Access token must not be empty.");
  }

  return {
    accessToken,
    user: response.user,
  };
}

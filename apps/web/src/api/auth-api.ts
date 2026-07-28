import type {
  AuthUserResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from "@ebookstore/contracts";

import { createApiClient, type JsonApiClient } from "./api-client";

export interface AuthApi {
  login(request: LoginRequest): Promise<LoginResponse>;

  register(request: RegisterRequest): Promise<AuthUserResponse>;

  getCurrentUser(accessToken: string): Promise<AuthUserResponse>;
}

function normalizeAccessToken(accessToken: string): string {
  const normalizedAccessToken = accessToken.trim();

  if (!normalizedAccessToken) {
    throw new TypeError("Access token must not be empty.");
  }

  return normalizedAccessToken;
}

export function createAuthApi(client: JsonApiClient): AuthApi {
  return {
    login(request: LoginRequest): Promise<LoginResponse> {
      return client.post<LoginResponse, LoginRequest>("/api/v1/auth/login", request);
    },

    register(request: RegisterRequest): Promise<AuthUserResponse> {
      return client.post<AuthUserResponse, RegisterRequest>("/api/v1/auth/register", request);
    },

    async getCurrentUser(accessToken: string): Promise<AuthUserResponse> {
      const normalizedAccessToken = normalizeAccessToken(accessToken);

      return client.get<AuthUserResponse>("/api/v1/auth/me", {
        accessToken: normalizedAccessToken,
      });
    },
  };
}

export const authApi = createAuthApi(
  createApiClient({
    baseUrl: import.meta.env["VITE_API_BASE_URL"] ?? "",
  }),
);

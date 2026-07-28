import type {
  AuthUserResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
} from "@ebookstore/contracts";
import { describe, expect, it, vi } from "vitest";

import { type ApiRequestOptions, type JsonApiClient } from "./api-client";
import { createAuthApi } from "./auth-api";

const user: AuthUserResponse = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

const loginResponse: LoginResponse = {
  accessToken: "signed.jwt.token",
  tokenType: "Bearer",
  expiresIn: 900,
  user,
};

interface PostCall {
  readonly path: string;
  readonly body: unknown;
  readonly options: ApiRequestOptions | undefined;
}

function createClient() {
  const getCalls: {
    readonly path: string;
    readonly options: ApiRequestOptions | undefined;
  }[] = [];

  const postCalls: PostCall[] = [];

  const client: JsonApiClient = {
    async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
      getCalls.push({
        path,
        options,
      });

      return user as T;
    },

    async post<TResponse, TBody>(
      path: string,
      body: TBody,
      options?: ApiRequestOptions,
    ): Promise<TResponse> {
      postCalls.push({
        path,
        body,
        options,
      });

      const response = path.endsWith("/login") ? loginResponse : user;

      return response as TResponse;
    },
  };

  return {
    client,
    getCalls,
    postCalls,
  };
}

describe("createAuthApi", () => {
  it("targets login and register with unchanged typed bodies", async () => {
    const { client, postCalls } = createClient();
    const api = createAuthApi(client);
    const loginRequest: LoginRequest = {
      email: "user@example.com",
      password: "Correct-Horse-42",
    };
    const registerRequest: RegisterRequest = {
      ...loginRequest,
      displayName: "Tomasz",
    };

    await expect(api.login(loginRequest)).resolves.toEqual(loginResponse);
    await expect(api.register(registerRequest)).resolves.toEqual(user);

    expect(postCalls).toEqual([
      {
        path: "/api/v1/auth/login",
        body: loginRequest,
        options: undefined,
      },
      {
        path: "/api/v1/auth/register",
        body: registerRequest,
        options: undefined,
      },
    ]);
  });

  it("sends a normalized token to the current-user endpoint", async () => {
    const { client, getCalls } = createClient();
    const api = createAuthApi(client);

    await expect(api.getCurrentUser(" valid-token ")).resolves.toEqual(user);

    expect(getCalls).toEqual([
      {
        path: "/api/v1/auth/me",
        options: {
          accessToken: "valid-token",
        },
      },
    ]);
  });

  it("rejects a missing token before invoking the client", async () => {
    const get = vi.fn();
    const client: JsonApiClient = {
      get,
      async post<TResponse>(): Promise<TResponse> {
        throw new Error("Unexpected POST request.");
      },
    };
    const api = createAuthApi(client);

    await expect(api.getCurrentUser("   ")).rejects.toThrow("Access token must not be empty.");

    expect(get).not.toHaveBeenCalled();
  });
});

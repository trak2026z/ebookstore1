import type {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserRole,
} from "@ebookstore/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ApiRequestOptions, JsonApiClient } from "./api-client";
import { createAdminUsersApi } from "./admin-users-api";

const user: AdminUserListItem = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  isActive: true,
  createdAt: "2026-07-22T10:00:00.000Z",
  updatedAt: "2026-07-22T10:00:00.000Z",
};

const listResponse: AdminUserListResponse = {
  items: [user],
  pagination: {
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 2,
  },
};

interface ClientCall {
  readonly method: "GET" | "PATCH";
  readonly path: string;
  readonly body?: unknown;
  readonly options: ApiRequestOptions | undefined;
}

function createClient() {
  const calls: ClientCall[] = [];

  const client: JsonApiClient = {
    async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
      calls.push({
        method: "GET",
        path,
        options,
      });

      return (path.includes("?") ? listResponse : user) as T;
    },

    async post<TResponse>(): Promise<TResponse> {
      throw new Error("Unexpected POST request.");
    },

    async patch<TResponse, TBody>(
      path: string,
      body: TBody,
      options?: ApiRequestOptions,
    ): Promise<TResponse> {
      calls.push({
        method: "PATCH",
        path,
        body,
        options,
      });

      return user as TResponse;
    },
  };

  return {
    client,
    calls,
  };
}

describe("createAdminUsersApi", () => {
  it("lists users with stable pagination and a normalized Bearer token", async () => {
    const { client, calls } = createClient();
    const api = createAdminUsersApi(client);

    await expect(
      api.listUsers(" admin-token ", {
        page: 2,
        pageSize: 20,
      }),
    ).resolves.toEqual(listResponse);

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/api/v1/admin/users?page=2&pageSize=20",
        options: {
          accessToken: "admin-token",
        },
      },
    ]);
  });

  it("gets a user through an encoded path segment", async () => {
    const { client, calls } = createClient();
    const api = createAdminUsersApi(client);

    await expect(api.getUser("admin-token", " user/id ")).resolves.toEqual(user);

    expect(calls).toEqual([
      {
        method: "GET",
        path: "/api/v1/admin/users/user%2Fid",
        options: {
          accessToken: "admin-token",
        },
      },
    ]);
  });

  it("updates role and status with unchanged typed PATCH bodies", async () => {
    const { client, calls } = createClient();
    const api = createAdminUsersApi(client);
    const role: AdminUserRole = "ADMIN";

    await expect(api.updateUserRole("admin-token", user.id, role)).resolves.toEqual(user);
    await expect(api.updateUserStatus("admin-token", user.id, false)).resolves.toEqual(user);

    expect(calls).toEqual([
      {
        method: "PATCH",
        path: `/api/v1/admin/users/${user.id}/role`,
        body: {
          role: "ADMIN",
        },
        options: {
          accessToken: "admin-token",
        },
      },
      {
        method: "PATCH",
        path: `/api/v1/admin/users/${user.id}/status`,
        body: {
          isActive: false,
        },
        options: {
          accessToken: "admin-token",
        },
      },
    ]);
  });

  it("rejects invalid input before invoking the HTTP client", async () => {
    const get = vi.fn();
    const patch = vi.fn();

    const client: JsonApiClient = {
      async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
        get(path, options);

        throw new Error("Unexpected GET request.");
      },

      async post<TResponse>(): Promise<TResponse> {
        throw new Error("Unexpected POST request.");
      },

      async patch<TResponse, TBody>(
        path: string,
        body: TBody,
        options?: ApiRequestOptions,
      ): Promise<TResponse> {
        patch(path, body, options);

        throw new Error("Unexpected PATCH request.");
      },
    };
    const api = createAdminUsersApi(client);

    await expect(
      api.listUsers("admin-token", {
        page: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow("Page must be a positive integer.");

    await expect(api.getUser("admin-token", "   ")).rejects.toThrow("User ID must not be empty.");

    await expect(api.updateUserStatus("   ", user.id, false)).rejects.toThrow(
      "Access token must not be empty.",
    );

    expect(get).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});

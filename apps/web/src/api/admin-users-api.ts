import type {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserRole,
  UpdateAdminUserRoleRequest,
  UpdateAdminUserStatusRequest,
} from "@ebookstore/contracts";

import { createApiClient, type JsonApiClient } from "./api-client";

export type AdminUserStatusFilter = "active" | "inactive";
export type AdminUserSortField = "createdAt" | "email" | "displayName" | "role" | "status";
export type AdminUserSortOrder = "asc" | "desc";

export interface AdminUserListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly query?: string;
  readonly role?: AdminUserRole;
  readonly status?: AdminUserStatusFilter;
  readonly sortBy?: AdminUserSortField;
  readonly order?: AdminUserSortOrder;
}

export interface AdminUsersApi {
  listUsers(accessToken: string, query: AdminUserListQuery): Promise<AdminUserListResponse>;

  getUser(accessToken: string, userId: string): Promise<AdminUserListItem>;

  updateUserRole(
    accessToken: string,
    userId: string,
    role: AdminUserRole,
  ): Promise<AdminUserListItem>;

  updateUserStatus(
    accessToken: string,
    userId: string,
    isActive: boolean,
  ): Promise<AdminUserListItem>;
}

function normalizeRequiredText(value: string, name: string): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new TypeError(`${name} must not be empty.`);
  }

  return normalizedValue;
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer.`);
  }

  return value;
}

function appendOptionalText(
  parameters: URLSearchParams,
  name: string,
  value: string | undefined,
): void {
  const normalizedValue = value?.trim();

  if (normalizedValue) {
    parameters.set(name, normalizedValue);
  }
}

function createUserPath(userId: string): string {
  const normalizedUserId = normalizeRequiredText(userId, "User ID");

  return `/api/v1/admin/users/${encodeURIComponent(normalizedUserId)}`;
}

function createListPath(query: AdminUserListQuery): string {
  const parameters = new URLSearchParams({
    page: String(normalizePositiveInteger(query.page, "Page")),
    pageSize: String(normalizePositiveInteger(query.pageSize, "Page size")),
  });

  appendOptionalText(parameters, "query", query.query);
  appendOptionalText(parameters, "role", query.role);
  appendOptionalText(parameters, "status", query.status);
  appendOptionalText(parameters, "sortBy", query.sortBy);
  appendOptionalText(parameters, "order", query.order);

  return `/api/v1/admin/users?${parameters.toString()}`;
}

function requestOptions(accessToken: string) {
  return {
    accessToken: normalizeRequiredText(accessToken, "Access token"),
  };
}

export function createAdminUsersApi(client: JsonApiClient): AdminUsersApi {
  return {
    async listUsers(
      accessToken: string,
      query: AdminUserListQuery,
    ): Promise<AdminUserListResponse> {
      return client.get<AdminUserListResponse>(createListPath(query), requestOptions(accessToken));
    },

    async getUser(accessToken: string, userId: string): Promise<AdminUserListItem> {
      return client.get<AdminUserListItem>(createUserPath(userId), requestOptions(accessToken));
    },

    async updateUserRole(
      accessToken: string,
      userId: string,
      role: AdminUserRole,
    ): Promise<AdminUserListItem> {
      const request: UpdateAdminUserRoleRequest = {
        role,
      };

      return client.patch<AdminUserListItem, UpdateAdminUserRoleRequest>(
        `${createUserPath(userId)}/role`,
        request,
        requestOptions(accessToken),
      );
    },

    async updateUserStatus(
      accessToken: string,
      userId: string,
      isActive: boolean,
    ): Promise<AdminUserListItem> {
      const request: UpdateAdminUserStatusRequest = {
        isActive,
      };

      return client.patch<AdminUserListItem, UpdateAdminUserStatusRequest>(
        `${createUserPath(userId)}/status`,
        request,
        requestOptions(accessToken),
      );
    },
  };
}

export const adminUsersApi = createAdminUsersApi(
  createApiClient({
    baseUrl: import.meta.env["VITE_API_BASE_URL"] ?? "",
  }),
);

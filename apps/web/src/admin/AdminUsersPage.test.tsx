// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AdminUserListItem, AdminUserListResponse } from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import { AdminUsersPage } from "./AdminUsersPage";

const user: AdminUserListItem = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  isActive: true,
  createdAt: "2026-07-22T10:00:00.000Z",
  updatedAt: "2026-07-23T10:00:00.000Z",
};

function createResponse(items: readonly AdminUserListItem[]): AdminUserListResponse {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: items.length > 0 ? 1 : 0,
    },
  };
}

function createApi(listUsers: AdminUsersApi["listUsers"]): AdminUsersApi {
  return {
    listUsers,

    async getUser() {
      throw new Error("Unexpected getUser request.");
    },

    async updateUserRole() {
      throw new Error("Unexpected updateUserRole request.");
    },

    async updateUserStatus() {
      throw new Error("Unexpected updateUserStatus request.");
    },
  };
}

afterEach(cleanup);

describe("AdminUsersPage", () => {
  it("loads the first page with the in-memory Bearer token", () => {
    const listUsers = vi
      .fn<AdminUsersApi["listUsers"]>()
      .mockReturnValue(new Promise<AdminUserListResponse>(() => undefined));

    render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Pobieranie użytkowników…");

    expect(listUsers).toHaveBeenCalledWith("signed.jwt.token", {
      page: 1,
      pageSize: 20,
    });
  });

  it("renders returned users with role, status and creation date", async () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockResolvedValue(
      createResponse([
        user,
        {
          ...user,
          id: "admin-id",
          email: "admin@example.com",
          displayName: null,
          role: "ADMIN",
          isActive: false,
        },
      ]),
    );

    const { container } = render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("table", {
        name: "Lista użytkowników sklepu",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Tomasz")).toBeInTheDocument();
    expect(screen.getByText("Nie ustawiono")).toBeInTheDocument();
    expect(screen.getByText("Użytkownik")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Aktywne")).toBeInTheDocument();
    expect(screen.getByText("Nieaktywne")).toBeInTheDocument();
    expect(screen.getByText("Wyświetlono 2 z 2 kont.")).toBeInTheDocument();

    const dates = Array.from(container.querySelectorAll("time"));

    expect(dates).toHaveLength(2);
    expect(dates[0]).toHaveAttribute("datetime", user.createdAt);
  });

  it("renders an empty state", async () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockResolvedValue(createResponse([]));

    render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(await screen.findByText("Brak użytkowników do wyświetlenia.")).toBeInTheDocument();

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("retries a temporary failure without clearing the session", async () => {
    const listUsers = vi
      .fn<AdminUsersApi["listUsers"]>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(createResponse([user]));

    const onSessionRejected = vi.fn();

    render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={onSessionRejected}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się pobrać użytkowników. Spróbuj ponownie.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spróbuj ponownie",
      }),
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();

    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(onSessionRejected).not.toHaveBeenCalled();
  });

  it("rejects the session after an unauthorized response", async () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token expired",
        requestId: "request-401",
        details: [],
      }),
    );

    const onSessionRejected = vi.fn();

    render(
      <AdminUsersPage
        accessToken="expired.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={onSessionRejected}
      />,
    );

    await waitFor(() => {
      expect(onSessionRejected).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Token expired")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nie udało się pobrać użytkowników. Spróbuj ponownie."),
    ).not.toBeInTheDocument();
  });

  it("renders access denied after a forbidden response", async () => {
    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockRejectedValue(
      new ApiClientError({
        status: 403,
        code: "FORBIDDEN",
        message: "Admin role required",
        requestId: "request-403",
        details: [],
      }),
    );

    const onSessionRejected = vi.fn();

    render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={onSessionRejected}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Brak dostępu do panelu administratora",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Admin role required")).not.toBeInTheDocument();
    expect(onSessionRejected).not.toHaveBeenCalled();
  });

  it("ignores a response resolved after unmount", async () => {
    let resolveRequest: ((response: AdminUserListResponse) => void) | undefined;

    const listUsers = vi.fn<AdminUsersApi["listUsers"]>().mockReturnValue(
      new Promise<AdminUserListResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const onSessionRejected = vi.fn();
    const { unmount } = render(
      <AdminUsersPage
        accessToken="signed.jwt.token"
        adminUsers={createApi(listUsers)}
        onSessionRejected={onSessionRejected}
      />,
    );

    unmount();

    await act(async () => {
      resolveRequest?.(createResponse([user]));
      await Promise.resolve();
    });

    expect(onSessionRejected).not.toHaveBeenCalled();
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AdminUserListItem } from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import { AdminUserDetailsPage } from "./AdminUserDetailsPage";

const user: AdminUserListItem = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  isActive: true,
  createdAt: "2026-07-22T10:00:00.000Z",
  updatedAt: "2026-07-23T11:30:00.000Z",
};

function createApi(getUser: AdminUsersApi["getUser"]): AdminUsersApi {
  return {
    async listUsers() {
      throw new Error("Unexpected listUsers request.");
    },

    getUser,

    async updateUserRole() {
      throw new Error("Unexpected updateUserRole request.");
    },

    async updateUserStatus() {
      throw new Error("Unexpected updateUserStatus request.");
    },
  };
}

function renderPage({
  getUser,
  returnPage = 2,
  onSessionRejected = vi.fn(),
}: {
  readonly getUser: AdminUsersApi["getUser"];
  readonly returnPage?: number;
  readonly onSessionRejected?: () => void;
}) {
  return render(
    <AdminUserDetailsPage
      accessToken="signed.jwt.token"
      adminUsers={createApi(getUser)}
      userId={user.id}
      returnPage={returnPage}
      onSessionRejected={onSessionRejected}
    />,
  );
}

afterEach(cleanup);

describe("AdminUserDetailsPage", () => {
  it("loads the selected user with the in-memory Bearer token", () => {
    const getUser = vi
      .fn<AdminUsersApi["getUser"]>()
      .mockReturnValue(new Promise<AdminUserListItem>(() => undefined));

    renderPage({
      getUser,
    });

    expect(screen.getByRole("status")).toHaveTextContent("Pobieranie danych użytkownika…");
    expect(getUser).toHaveBeenCalledWith("signed.jwt.token", user.id);
  });

  it("renders user details and preserves the return page", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);

    const { container } = renderPage({
      getUser,
      returnPage: 3,
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Szczegóły użytkownika",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Tomasz")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Użytkownik")).toBeInTheDocument();
    expect(screen.getByText("Aktywne")).toBeInTheDocument();
    expect(screen.getByText(user.id)).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Wróć do listy użytkowników",
      }),
    ).toHaveAttribute("href", "/admin/users?page=3");

    const dates = Array.from(container.querySelectorAll("time"));

    expect(dates).toHaveLength(2);
    expect(dates[0]).toHaveAttribute("datetime", user.createdAt);
    expect(dates[1]).toHaveAttribute("datetime", user.updatedAt);
  });

  it("retries a temporary failure without clearing the session", async () => {
    const getUser = vi
      .fn<AdminUsersApi["getUser"]>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(user);
    const onSessionRejected = vi.fn();

    renderPage({
      getUser,
      onSessionRejected,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się pobrać danych użytkownika. Spróbuj ponownie.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spróbuj ponownie",
      }),
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(onSessionRejected).not.toHaveBeenCalled();
  });

  it("rejects the session after an unauthorized response", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token expired",
        requestId: "request-401",
        details: [],
      }),
    );
    const onSessionRejected = vi.fn();

    renderPage({
      getUser,
      onSessionRejected,
    });

    await waitFor(() => {
      expect(onSessionRejected).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Token expired")).not.toBeInTheDocument();
  });

  it("renders access denied after a forbidden response", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockRejectedValue(
      new ApiClientError({
        status: 403,
        code: "FORBIDDEN",
        message: "Admin role required",
        requestId: "request-403",
        details: [],
      }),
    );

    renderPage({
      getUser,
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Brak dostępu do panelu administratora",
      }),
    ).toBeInTheDocument();
  });

  it("renders a neutral not-found state", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockRejectedValue(
      new ApiClientError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "Internal user message",
        requestId: "request-404",
        details: [],
      }),
    );

    renderPage({
      getUser,
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Nie znaleziono użytkownika",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByText("Internal user message")).not.toBeInTheDocument();
  });

  it("ignores a response resolved after unmount", async () => {
    let resolveRequest: ((response: AdminUserListItem) => void) | undefined;

    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockReturnValue(
      new Promise<AdminUserListItem>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const onSessionRejected = vi.fn();
    const { unmount } = renderPage({
      getUser,
      onSessionRejected,
    });

    unmount();

    await act(async () => {
      resolveRequest?.(user);
      await Promise.resolve();
    });

    expect(onSessionRejected).not.toHaveBeenCalled();
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });
});

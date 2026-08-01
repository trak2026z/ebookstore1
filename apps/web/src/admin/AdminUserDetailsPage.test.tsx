// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AdminUserListItem } from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import {
  EMPTY_ADMIN_USERS_QUERY,
  type AdminUsersRouteQuery,
} from "../navigation/browser-navigation";
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

function unexpectedRoleUpdate(): Promise<AdminUserListItem> {
  throw new Error("Unexpected updateUserRole request.");
}

function unexpectedStatusUpdate(): Promise<AdminUserListItem> {
  throw new Error("Unexpected updateUserStatus request.");
}

function createApi({
  getUser,
  updateUserRole = unexpectedRoleUpdate,
  updateUserStatus = unexpectedStatusUpdate,
}: {
  readonly getUser: AdminUsersApi["getUser"];
  readonly updateUserRole?: AdminUsersApi["updateUserRole"];
  readonly updateUserStatus?: AdminUsersApi["updateUserStatus"];
}): AdminUsersApi {
  return {
    async listUsers() {
      throw new Error("Unexpected listUsers request.");
    },

    getUser,
    updateUserRole,
    updateUserStatus,
  };
}

function renderPage({
  getUser,
  updateUserRole = unexpectedRoleUpdate,
  updateUserStatus = unexpectedStatusUpdate,
  currentUserId = "admin-actor",
  returnQuery = {
    ...EMPTY_ADMIN_USERS_QUERY,
    page: 2,
  },
  onSessionRejected = vi.fn(),
}: {
  readonly getUser: AdminUsersApi["getUser"];
  readonly updateUserRole?: AdminUsersApi["updateUserRole"];
  readonly updateUserStatus?: AdminUsersApi["updateUserStatus"];
  readonly currentUserId?: string;
  readonly returnQuery?: AdminUsersRouteQuery;
  readonly onSessionRejected?: () => void;
}) {
  return render(
    <AdminUserDetailsPage
      accessToken="signed.jwt.token"
      adminUsers={createApi({
        getUser,
        updateUserRole,
        updateUserStatus,
      })}
      currentUserId={currentUserId}
      userId={user.id}
      returnQuery={returnQuery}
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

  it("renders user details and preserves return filters", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);

    const { container } = renderPage({
      getUser,
      returnQuery: {
        page: 3,
        query: "tomasz",
        role: "USER",
        status: "active",
        sortBy: "email",
        order: "asc",
      },
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
    ).toHaveAttribute(
      "href",
      "/admin/users?page=3&query=tomasz&role=USER&status=active&sortBy=email&order=asc",
    );

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

  it("changes a role only after explicit confirmation", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserRole = vi.fn<AdminUsersApi["updateUserRole"]>().mockResolvedValue({
      ...user,
      role: "ADMIN",
      updatedAt: "2026-07-24T12:00:00.000Z",
    });

    renderPage({
      getUser,
      updateUserRole,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Nadaj rolę administratora",
      }),
    );

    expect(
      screen.getByRole("alertdialog", {
        name: "Potwierdź zmianę",
      }),
    ).toHaveTextContent("Zmienić rolę konta user@example.com na administrator?");
    expect(updateUserRole).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Potwierdź zmianę",
      }),
    );

    expect(await screen.findByText("Rola użytkownika została zmieniona.")).toBeInTheDocument();
    expect(updateUserRole).toHaveBeenCalledWith("signed.jwt.token", user.id, "ADMIN");
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("changes a status only after explicit confirmation", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserStatus = vi.fn<AdminUsersApi["updateUserStatus"]>().mockResolvedValue({
      ...user,
      isActive: false,
      updatedAt: "2026-07-24T12:00:00.000Z",
    });

    renderPage({
      getUser,
      updateUserStatus,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Dezaktywuj konto",
      }),
    );

    expect(updateUserStatus).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Potwierdź zmianę",
      }),
    );

    expect(await screen.findByText("Status użytkownika został zmieniony.")).toBeInTheDocument();
    expect(updateUserStatus).toHaveBeenCalledWith("signed.jwt.token", user.id, false);
    expect(screen.getByText("Nieaktywne")).toBeInTheDocument();
  });

  it("cancels a pending action without calling the API", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserStatus = vi.fn<AdminUsersApi["updateUserStatus"]>();

    renderPage({
      getUser,
      updateUserStatus,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Dezaktywuj konto",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Anuluj",
      }),
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(updateUserStatus).not.toHaveBeenCalled();
    expect(screen.getByText("Aktywne")).toBeInTheDocument();
  });

  it("blocks role and status changes for the current administrator", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue({
      ...user,
      role: "ADMIN",
    });
    const updateUserRole = vi.fn<AdminUsersApi["updateUserRole"]>();
    const updateUserStatus = vi.fn<AdminUsersApi["updateUserStatus"]>();

    renderPage({
      getUser,
      updateUserRole,
      updateUserStatus,
      currentUserId: user.id,
    });

    expect(
      await screen.findByText(
        "Nie możesz zmienić własnej roli ani dezaktywować własnego konta administratora.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Zmień rolę na użytkownika",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Dezaktywuj konto",
      }),
    ).toBeDisabled();
    expect(updateUserRole).not.toHaveBeenCalled();
    expect(updateUserStatus).not.toHaveBeenCalled();
  });

  it("shows a neutral conflict message without changing the user", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserRole = vi.fn<AdminUsersApi["updateUserRole"]>().mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "CONFLICT",
        message: "Cannot change role",
        requestId: "request-409",
        details: [],
      }),
    );

    renderPage({
      getUser,
      updateUserRole,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Nadaj rolę administratora",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Potwierdź zmianę",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie można wykonać tej operacji. Konto musi zachować bezpieczne uprawnienia administratora.",
    );
    expect(screen.queryByText("Cannot change role")).not.toBeInTheDocument();
    expect(screen.getByText("Użytkownik")).toBeInTheDocument();
  });

  it("rejects the session when an update returns unauthorized", async () => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserStatus = vi.fn<AdminUsersApi["updateUserStatus"]>().mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token expired",
        requestId: "request-update-401",
        details: [],
      }),
    );
    const onSessionRejected = vi.fn();

    renderPage({
      getUser,
      updateUserStatus,
      onSessionRejected,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Dezaktywuj konto",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Potwierdź zmianę",
      }),
    );

    await waitFor(() => {
      expect(onSessionRejected).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Token expired")).not.toBeInTheDocument();
  });

  it.each([
    {
      status: 403,
      code: "FORBIDDEN",
      heading: "Brak dostępu do panelu administratora",
    },
    {
      status: 404,
      code: "USER_NOT_FOUND",
      heading: "Nie znaleziono użytkownika",
    },
  ])("handles HTTP $status returned while updating a user", async ({ status, code, heading }) => {
    const getUser = vi.fn<AdminUsersApi["getUser"]>().mockResolvedValue(user);
    const updateUserRole = vi.fn<AdminUsersApi["updateUserRole"]>().mockRejectedValue(
      new ApiClientError({
        status,
        code,
        message: "Internal API message",
        requestId: `request-${status}`,
        details: [],
      }),
    );

    renderPage({
      getUser,
      updateUserRole,
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Nadaj rolę administratora",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Potwierdź zmianę",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: heading,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Internal API message")).not.toBeInTheDocument();
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

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AuthUserResponse } from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/api-client";
import { ProfilePage, type ProfileApi } from "./ProfilePage";

const user: AuthUserResponse = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

afterEach(cleanup);

describe("ProfilePage", () => {
  it("shows a loading state while the protected request is pending", () => {
    const getCurrentUser = vi
      .fn<ProfileApi["getCurrentUser"]>()
      .mockReturnValue(new Promise<AuthUserResponse>(() => undefined));

    render(
      <ProfilePage
        accessToken="signed.jwt.token"
        auth={{
          getCurrentUser,
        }}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Pobieranie profilu…");

    expect(getCurrentUser).toHaveBeenCalledWith("signed.jwt.token");
  });

  it("renders authoritative profile data returned by the API", async () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>().mockResolvedValue(user);

    const { container } = render(
      <ProfilePage
        accessToken="signed.jwt.token"
        auth={{
          getCurrentUser,
        }}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(await screen.findByText("Tomasz")).toBeInTheDocument();

    expect(screen.getByText("user@example.com")).toBeInTheDocument();

    expect(screen.getByText("Użytkownik")).toBeInTheDocument();

    const time = container.querySelector("time");

    expect(time).toHaveAttribute("datetime", user.createdAt);
  });

  it("renders a safe fallback for a missing display name", async () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>().mockResolvedValue({
      ...user,
      displayName: null,
      role: "ADMIN",
    });

    render(
      <ProfilePage
        accessToken="signed.jwt.token"
        auth={{
          getCurrentUser,
        }}
        onSessionRejected={vi.fn()}
      />,
    );

    expect(await screen.findByText("Nie ustawiono")).toBeInTheDocument();

    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("retries a temporary profile failure without clearing the session", async () => {
    const getCurrentUser = vi
      .fn<ProfileApi["getCurrentUser"]>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(user);

    const onSessionRejected = vi.fn();

    render(
      <ProfilePage
        accessToken="signed.jwt.token"
        auth={{
          getCurrentUser,
        }}
        onSessionRejected={onSessionRejected}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się pobrać profilu. Spróbuj ponownie.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spróbuj ponownie",
      }),
    );

    expect(await screen.findByText("Tomasz")).toBeInTheDocument();

    expect(getCurrentUser).toHaveBeenCalledTimes(2);

    expect(onSessionRejected).not.toHaveBeenCalled();
  });

  it("rejects the in-memory session after an unauthorized response", async () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>().mockRejectedValue(
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
      <ProfilePage
        accessToken="expired.jwt.token"
        auth={{
          getCurrentUser,
        }}
        onSessionRejected={onSessionRejected}
      />,
    );

    await waitFor(() => {
      expect(onSessionRejected).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Token expired")).not.toBeInTheDocument();

    expect(
      screen.queryByText("Nie udało się pobrać profilu. Spróbuj ponownie."),
    ).not.toBeInTheDocument();
  });
});

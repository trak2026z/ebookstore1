// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  AuthUserResponse,
  LoginResponse,
  PublicBookDetailsResponse,
  PublicBookListResponse,
} from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { type AppCatalogApi } from "../App";
import { ApiClientError } from "../api/api-client";
import type { RegistrationApi } from "./RegisterPage";
import type { ProfileApi } from "./ProfilePage";

const sessionUser: AuthUserResponse = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

const profileUser: AuthUserResponse = {
  ...sessionUser,
  displayName: "Tomasz z profilu",
  role: "ADMIN",
};

const loginResponse: LoginResponse = {
  accessToken: "signed.jwt.token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: sessionUser,
};

const bookDetails: PublicBookDetailsResponse = {
  id: "book-1",
  slug: "typescript",
  title: "TypeScript",
  authors: [],
  categories: [],
  price: {
    amountMinor: 4_999,
    currency: "PLN",
  },
  format: "EPUB",
  coverUrl: null,
  isbn: "978-83-00000-00-1",
  description: "Praktyczny przewodnik.",
};

function createCatalog(): AppCatalogApi {
  const response: PublicBookListResponse = {
    items: [],
    pagination: {
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 0,
    },
  };

  return {
    async getBooks() {
      return response;
    },

    async getBook() {
      return bookDetails;
    },
  };
}

function createAuth(): RegistrationApi {
  return {
    async register() {
      return sessionUser;
    },

    async login() {
      return loginResponse;
    },
  };
}

function fillAndSubmitLogin(): void {
  fireEvent.change(screen.getByLabelText("Adres e-mail"), {
    target: {
      value: "user@example.com",
    },
  });

  fireEvent.change(screen.getByLabelText("Hasło"), {
    target: {
      value: "Correct-Horse-42",
    },
  });

  fireEvent.click(
    screen.getByRole("button", {
      name: "Zaloguj się",
    }),
  );
}

afterEach(() => {
  cleanup();

  window.history.replaceState(null, "", "/");
});

describe("profile flow", () => {
  it("protects a direct profile URL without calling the API", () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>();

    window.history.replaceState(null, "", "/profile");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth()}
        profile={{
          getCurrentUser,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Profil wymaga logowania",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Przejdź do logowania",
      }),
    ).toHaveAttribute("href", "/login");

    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("loads the authoritative profile with the in-memory access token", async () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>().mockResolvedValue(profileUser);

    window.history.replaceState(null, "", "/login");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth()}
        profile={{
          getCurrentUser,
        }}
      />,
    );

    fillAndSubmitLogin();

    const profileLink = await screen.findByRole("link", {
      name: "Zalogowano jako user@example.com",
    });

    fireEvent.click(profileLink);

    expect(window.location.pathname).toBe("/profile");

    expect(await screen.findByText("Tomasz z profilu")).toBeInTheDocument();

    expect(screen.getByText("Administrator")).toBeInTheDocument();

    expect(getCurrentUser).toHaveBeenCalledWith("signed.jwt.token");
  });

  it("clears an expired session after the protected endpoint returns 401", async () => {
    const getCurrentUser = vi.fn<ProfileApi["getCurrentUser"]>().mockRejectedValue(
      new ApiClientError({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token expired",
        requestId: "request-401",
        details: [],
      }),
    );

    window.history.replaceState(null, "", "/login");

    render(
      <App
        catalog={createCatalog()}
        auth={createAuth()}
        profile={{
          getCurrentUser,
        }}
      />,
    );

    fillAndSubmitLogin();

    fireEvent.click(
      await screen.findByRole("link", {
        name: "Zalogowano jako user@example.com",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Profil wymaga logowania",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Zalogowano jako user@example.com")).not.toBeInTheDocument();

    expect(window.location.pathname).toBe("/profile");
  });
});

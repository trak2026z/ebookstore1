// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  AuthUserResponse,
  LoginRequest,
  LoginResponse,
  PublicBookDetailsResponse,
  PublicBookListResponse,
  RegisterRequest,
} from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App, { type AppCatalogApi } from "../App";
import type { RegistrationApi } from "./RegisterPage";

const authUser: AuthUserResponse = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
};

const loginResponse: LoginResponse = {
  accessToken: "signed.jwt.token",
  tokenType: "Bearer",
  expiresIn: 900,
  user: authUser,
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
      return authUser;
    },

    async login() {
      return loginResponse;
    },
  };
}

afterEach(() => {
  cleanup();

  window.history.replaceState(null, "", "/");
});

describe("registration flow", () => {
  it("navigates between login and registration without reloading", () => {
    window.history.replaceState(null, "", "/login");

    render(<App catalog={createCatalog()} auth={createAuth()} />);

    fireEvent.click(
      screen.getByRole("link", {
        name: "Utwórz konto",
      }),
    );

    expect(window.location.pathname).toBe("/register");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Utwórz konto",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("link", {
        name: "Przejdź do logowania",
      }),
    );

    expect(window.location.pathname).toBe("/login");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();
  });

  it("creates an account, logs in and returns to the catalog", async () => {
    const registerRequests: RegisterRequest[] = [];
    const loginRequests: LoginRequest[] = [];

    const auth: RegistrationApi = {
      async register(request) {
        registerRequests.push(request);

        return authUser;
      },

      async login(request) {
        loginRequests.push(request);

        return loginResponse;
      },
    };

    window.history.replaceState(null, "", "/register");

    render(<App catalog={createCatalog()} auth={auth} />);

    fireEvent.change(screen.getByLabelText("Adres e-mail"), {
      target: {
        value: "user@example.com",
      },
    });

    fireEvent.change(screen.getByLabelText("Nazwa wyświetlana"), {
      target: {
        value: " Tomasz ",
      },
    });

    fireEvent.change(screen.getByLabelText("Hasło"), {
      target: {
        value: "Correct-Horse-42",
      },
    });

    fireEvent.change(screen.getByLabelText("Potwierdź hasło"), {
      target: {
        value: "Correct-Horse-42",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Utwórz konto",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();

    expect(window.location.pathname).toBe("/");

    expect(screen.getByLabelText("Zalogowano jako user@example.com")).toHaveTextContent(
      "user@example.com",
    );

    expect(registerRequests).toEqual([
      {
        email: "user@example.com",
        displayName: "Tomasz",
        password: "Correct-Horse-42",
      },
    ]);

    expect(loginRequests).toEqual([
      {
        email: "user@example.com",
        password: "Correct-Horse-42",
      },
    ]);
  });
});

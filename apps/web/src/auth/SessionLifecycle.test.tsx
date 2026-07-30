// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  AuthUserResponse,
  LoginResponse,
  PublicBookDetailsResponse,
  PublicBookListResponse,
} from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App, { type AppCatalogApi } from "../App";
import type { RegistrationApi } from "./RegisterPage";

const user: AuthUserResponse = {
  id: "user-1",
  email: "user@example.com",
  displayName: "Tomasz",
  role: "USER",
  createdAt: "2026-07-22T10:00:00.000Z",
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

function createLoginResponse(expiresIn: number): LoginResponse {
  return {
    accessToken: "signed.jwt.token",
    tokenType: "Bearer",
    expiresIn,
    user,
  };
}

function createAuth(lifetimes: readonly number[]): RegistrationApi {
  const pendingLifetimes = [...lifetimes];

  return {
    async register() {
      return user;
    },

    async login() {
      const expiresIn = pendingLifetimes.shift();

      if (expiresIn === undefined) {
        throw new Error("Missing login response.");
      }

      return createLoginResponse(expiresIn);
    },
  };
}

async function signIn(): Promise<void> {
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

  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", {
        name: "Zaloguj się",
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
  });

  expect(
    screen.getByRole("link", {
      name: "Zalogowano jako user@example.com",
    }),
  ).toBeInTheDocument();
}

beforeEach(() => {
  vi.useFakeTimers();

  vi.setSystemTime(new Date("2026-07-30T18:00:00.000Z"));

  window.history.replaceState(null, "", "/login");
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();

  window.history.replaceState(null, "", "/");
});

describe("authentication session lifecycle", () => {
  it("logs out explicitly and returns from a protected route to the catalog", async () => {
    render(
      <App
        catalog={createCatalog()}
        auth={createAuth([900])}
        profile={{
          async getCurrentUser() {
            return user;
          },
        }}
      />,
    );

    await signIn();

    fireEvent.click(
      screen.getByRole("link", {
        name: "Zalogowano jako user@example.com",
      }),
    );

    expect(window.location.pathname).toBe("/profile");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Wyloguj się",
      }),
    );

    expect(window.location.pathname).toBe("/");

    expect(
      screen.getByRole("link", {
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Zalogowano jako user@example.com")).not.toBeInTheDocument();
  });

  it("clears the in-memory session exactly when its lifetime elapses", async () => {
    render(<App catalog={createCatalog()} auth={createAuth([1])} />);

    await signIn();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.getByLabelText("Zalogowano jako user@example.com")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(
      screen.getByRole("link", {
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();

    expect(screen.queryByLabelText("Zalogowano jako user@example.com")).not.toBeInTheDocument();
  });

  it("cancels the previous timer before a later session is created", async () => {
    render(<App catalog={createCatalog()} auth={createAuth([1, 10])} />);

    await signIn();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Wyloguj się",
      }),
    );

    fireEvent.click(
      screen.getByRole("link", {
        name: "Zaloguj się",
      }),
    );

    await signIn();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByLabelText("Zalogowano jako user@example.com")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(9_499);
    });

    expect(screen.getByLabelText("Zalogowano jako user@example.com")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(
      screen.getByRole("link", {
        name: "Zaloguj się",
      }),
    ).toBeInTheDocument();
  });
});

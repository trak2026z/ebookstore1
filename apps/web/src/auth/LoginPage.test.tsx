// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AuthUserResponse, LoginResponse } from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/api-client";
import { LoginPage, type LoginApi } from "./LoginPage";

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

afterEach(cleanup);

function fillLoginForm(): void {
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
}

describe("LoginPage", () => {
  it("renders accessible fields with authentication autocomplete values", () => {
    const auth: LoginApi = {
      async login() {
        return loginResponse;
      },
    };

    render(<LoginPage auth={auth} onAuthenticated={vi.fn()} />);

    expect(screen.getByLabelText("Adres e-mail")).toHaveAttribute("autocomplete", "email");

    expect(screen.getByLabelText("Hasło")).toHaveAttribute("autocomplete", "current-password");
  });

  it("submits a normalized email and returns an in-memory session under StrictMode", async () => {
    const login = vi.fn<LoginApi["login"]>().mockResolvedValue(loginResponse);
    const onAuthenticated = vi.fn();

    render(
      <StrictMode>
        <LoginPage auth={{ login }} onAuthenticated={onAuthenticated} />
      </StrictMode>,
    );

    fillLoginForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Zaloguj się",
      }),
    );

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith({
        accessToken: "signed.jwt.token",
        user,
        expiresAt: expect.any(Number),
      });
    });

    expect(login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Correct-Horse-42",
    });
  });

  it("shows a neutral 401 error, preserves email and clears password", async () => {
    const error = new ApiClientError({
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
      requestId: "request-401",
      details: [],
    });
    const auth: LoginApi = {
      async login() {
        throw error;
      },
    };

    render(<LoginPage auth={auth} onAuthenticated={vi.fn()} />);

    fillLoginForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Zaloguj się",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowy e-mail lub hasło.");

    expect(screen.getByLabelText("Adres e-mail")).toHaveValue("user@example.com");

    expect(screen.getByLabelText("Hasło")).toHaveValue("");

    expect(
      screen.getByRole("button", {
        name: "Zaloguj się",
      }),
    ).toBeEnabled();
  });

  it("prevents concurrent login submissions", async () => {
    let resolveLogin: ((response: LoginResponse) => void) | undefined;

    const pendingLogin = new Promise<LoginResponse>((resolve) => {
      resolveLogin = resolve;
    });

    const login = vi.fn<LoginApi["login"]>().mockReturnValue(pendingLogin);
    const onAuthenticated = vi.fn();

    render(<LoginPage auth={{ login }} onAuthenticated={onAuthenticated} />);

    fillLoginForm();

    const button = screen.getByRole("button", {
      name: "Zaloguj się",
    });

    const form = button.closest("form");

    if (!form) {
      throw new Error("Login form was not rendered.");
    }

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(login).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole("button", {
        name: "Logowanie…",
      }),
    ).toBeDisabled();

    await act(async () => {
      resolveLogin?.(loginResponse);
      await pendingLogin;
    });

    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AuthUserResponse, LoginResponse } from "@ebookstore/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/api-client";
import { RegisterPage, type RegistrationApi } from "./RegisterPage";

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

afterEach(cleanup);

function fillRegistrationForm({
  confirmation = "Correct-Horse-42",
}: {
  readonly confirmation?: string;
} = {}): void {
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
      value: confirmation,
    },
  });
}

function createApi({
  register = vi.fn<RegistrationApi["register"]>().mockResolvedValue(authUser),
  login = vi.fn<RegistrationApi["login"]>().mockResolvedValue(loginResponse),
}: {
  readonly register?: ReturnType<typeof vi.fn<RegistrationApi["register"]>>;
  readonly login?: ReturnType<typeof vi.fn<RegistrationApi["login"]>>;
} = {}): {
  readonly auth: RegistrationApi;
  readonly register: typeof register;
  readonly login: typeof login;
} {
  return {
    auth: {
      register,
      login,
    },
    register,
    login,
  };
}

describe("RegisterPage", () => {
  it("renders accessible account fields and a login link", () => {
    const { auth } = createApi();

    render(<RegisterPage auth={auth} onAuthenticated={vi.fn()} />);

    expect(screen.getByLabelText("Adres e-mail")).toHaveAttribute("autocomplete", "email");

    expect(screen.getByLabelText("Nazwa wyświetlana")).toHaveAttribute("autocomplete", "name");

    expect(screen.getByLabelText("Hasło")).toHaveAttribute("autocomplete", "new-password");

    expect(screen.getByLabelText("Potwierdź hasło")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );

    expect(
      screen.getByRole("link", {
        name: "Przejdź do logowania",
      }),
    ).toHaveAttribute("href", "/login");
  });

  it("rejects mismatched passwords before calling the API", async () => {
    const { auth, register, login } = createApi();

    render(<RegisterPage auth={auth} onAuthenticated={vi.fn()} />);

    fillRegistrationForm({
      confirmation: "Different-Horse-42",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Utwórz konto",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Hasła muszą być identyczne.");

    expect(register).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it("registers, logs in and returns an in-memory session", async () => {
    const { auth, register, login } = createApi();
    const onAuthenticated = vi.fn();

    render(<RegisterPage auth={auth} onAuthenticated={onAuthenticated} />);

    fillRegistrationForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Utwórz konto",
      }),
    );

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith({
        accessToken: "signed.jwt.token",
        user: authUser,
        expiresAt: expect.any(Number),
      });
    });

    expect(register).toHaveBeenCalledWith({
      email: "user@example.com",
      displayName: "Tomasz",
      password: "Correct-Horse-42",
    });

    expect(login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Correct-Horse-42",
    });

    expect(register.mock.invocationCallOrder[0]).toBeLessThan(
      login.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it("shows a neutral conflict error and clears passwords", async () => {
    const register = vi.fn<RegistrationApi["register"]>().mockRejectedValue(
      new ApiClientError({
        status: 409,
        code: "CONFLICT",
        message: "Email already exists",
        requestId: "request-409",
        details: [],
      }),
    );

    const { auth, login } = createApi({
      register,
    });

    render(<RegisterPage auth={auth} onAuthenticated={vi.fn()} />);

    fillRegistrationForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Utwórz konto",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie można utworzyć konta dla podanego adresu e-mail.",
    );

    expect(screen.getByLabelText("Adres e-mail")).toHaveValue("user@example.com");

    expect(screen.getByLabelText("Nazwa wyświetlana")).toHaveValue(" Tomasz ");

    expect(screen.getByLabelText("Hasło")).toHaveValue("");

    expect(screen.getByLabelText("Potwierdź hasło")).toHaveValue("");

    expect(login).not.toHaveBeenCalled();
  });

  it("prevents concurrent registration submissions", async () => {
    let resolveRegister: ((user: AuthUserResponse) => void) | undefined;

    const pendingRegister = new Promise<AuthUserResponse>((resolve) => {
      resolveRegister = resolve;
    });

    const register = vi.fn<RegistrationApi["register"]>().mockReturnValue(pendingRegister);

    const { auth, login } = createApi({
      register,
    });

    const onAuthenticated = vi.fn();

    render(<RegisterPage auth={auth} onAuthenticated={onAuthenticated} />);

    fillRegistrationForm();

    const button = screen.getByRole("button", {
      name: "Utwórz konto",
    });

    const form = button.closest("form");

    if (!form) {
      throw new Error("Registration form was not rendered.");
    }

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(register).toHaveBeenCalledTimes(1);

    expect(
      screen.getByRole("button", {
        name: "Tworzenie konta…",
      }),
    ).toBeDisabled();

    await act(async () => {
      resolveRegister?.(authUser);
      await pendingRegister;
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(1);

      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it("requires manual login after a successful registration when automatic login fails", async () => {
    const login = vi
      .fn<RegistrationApi["login"]>()
      .mockRejectedValue(new Error("Network unavailable"));

    const { auth } = createApi({
      login,
    });

    render(<RegisterPage auth={auth} onAuthenticated={vi.fn()} />);

    fillRegistrationForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Utwórz konto",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Konto zostało utworzone, ale automatyczne logowanie nie powiodło się.",
    );

    expect(
      screen.queryByRole("button", {
        name: "Utwórz konto",
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Przejdź do logowania",
      }),
    ).toHaveAttribute("href", "/login");
  });
});

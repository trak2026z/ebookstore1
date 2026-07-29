import type { LoginRequest, LoginResponse } from "@ebookstore/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ApiClientError } from "../api/api-client";
import { createAuthSession, type AuthSession } from "./auth-session";

const INVALID_CREDENTIALS_MESSAGE = "Nieprawidłowy e-mail lub hasło.";

const LOGIN_FAILED_MESSAGE = "Nie udało się zalogować. Spróbuj ponownie.";

export interface LoginApi {
  login(request: LoginRequest): Promise<LoginResponse>;
}

export interface LoginPageProps {
  readonly auth: LoginApi;
  readonly onAuthenticated: (session: AuthSession) => void;
}

type LoginState =
  | { readonly status: "idle" }
  | { readonly status: "submitting" }
  | {
      readonly status: "error";
      readonly message: string;
    };

function createLoginErrorMessage(error: unknown): string {
  return error instanceof ApiClientError && error.status === 401
    ? INVALID_CREDENTIALS_MESSAGE
    : LOGIN_FAILED_MESSAGE;
}

export function LoginPage({ auth, onAuthenticated }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<LoginState>({
    status: "idle",
  });

  const submitInProgress = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const isSubmitting = state.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (submitInProgress.current) {
      return;
    }

    submitInProgress.current = true;
    setState({
      status: "submitting",
    });

    try {
      const response = await auth.login({
        email: email.trim(),
        password,
      });

      if (mounted.current) {
        onAuthenticated(createAuthSession(response));
      }
    } catch (error) {
      if (mounted.current) {
        setPassword("");
        setState({
          status: "error",
          message: createLoginErrorMessage(error),
        });
      }
    } finally {
      submitInProgress.current = false;
    }
  }

  return (
    <section className="login-page shell" aria-labelledby="login-title">
      <div className="login-card">
        <p className="eyebrow">Konto użytkownika</p>

        <h1 id="login-title">Zaloguj się</h1>

        <p className="login-card__summary">
          Podaj dane konta. Sesja pozostanie aktywna tylko do odświeżenia strony.
        </p>

        <form
          className="login-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <label>
            Adres e-mail
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
              }}
            />
          </label>

          <label>
            Hasło
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                setPassword(event.currentTarget.value);
              }}
            />
          </label>

          {state.status === "error" && (
            <p className="login-form__error" role="alert">
              {state.message}
            </p>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logowanie…" : "Zaloguj się"}
          </button>
        </form>

        <p>
          Nie masz konta?{" "}
          <a href="/register" data-app-link="true">
            Utwórz konto
          </a>
        </p>

        <a className="login-page__back" href="/" data-app-link="true">
          Wróć do katalogu
        </a>
      </div>
    </section>
  );
}

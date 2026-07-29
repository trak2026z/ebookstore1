import type {
  AuthUserResponse,
  LoginRequest,
  RegisterRequest,
} from "@ebookstore/contracts";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ApiClientError } from "../api/api-client";
import type { LoginApi } from "./LoginPage";
import { createAuthSession, type AuthSession } from "./auth-session";

const PASSWORD_MISMATCH_MESSAGE = "Hasła muszą być identyczne.";

const DISPLAY_NAME_REQUIRED_MESSAGE = "Podaj nazwę wyświetlaną.";

const ACCOUNT_UNAVAILABLE_MESSAGE = "Nie można utworzyć konta dla podanego adresu e-mail.";

const REGISTRATION_FAILED_MESSAGE = "Nie udało się utworzyć konta. Spróbuj ponownie.";

const AUTOMATIC_LOGIN_FAILED_MESSAGE =
  "Konto zostało utworzone, ale automatyczne logowanie nie powiodło się.";

export interface RegistrationApi extends LoginApi {
  register(request: RegisterRequest): Promise<AuthUserResponse>;
}

export interface RegisterPageProps {
  readonly auth: RegistrationApi;
  readonly onAuthenticated: (session: AuthSession) => void;
}

type RegistrationState =
  | { readonly status: "idle" }
  | { readonly status: "submitting" }
  | {
      readonly status: "error";
      readonly message: string;
    }
  | {
      readonly status: "login-required";
      readonly message: string;
    };

function createRegistrationErrorMessage(error: unknown): string {
  return error instanceof ApiClientError && error.status === 409
    ? ACCOUNT_UNAVAILABLE_MESSAGE
    : REGISTRATION_FAILED_MESSAGE;
}

function createRegisterRequest({
  email,
  displayName,
  password,
}: {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}): RegisterRequest {
  return {
    email: email.trim(),
    displayName: displayName.trim(),
    password,
  };
}

export function RegisterPage({ auth, onAuthenticated }: RegisterPageProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [state, setState] = useState<RegistrationState>({
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

  function clearPasswords(): void {
    setPassword("");
    setPasswordConfirmation("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (submitInProgress.current) {
      return;
    }

    if (!displayName.trim()) {
      setState({
        status: "error",
        message: DISPLAY_NAME_REQUIRED_MESSAGE,
      });

      return;
    }

    if (password !== passwordConfirmation) {
      setState({
        status: "error",
        message: PASSWORD_MISMATCH_MESSAGE,
      });

      return;
    }

    const request = createRegisterRequest({
      email,
      displayName,
      password,
    });

    submitInProgress.current = true;

    setState({
      status: "submitting",
    });

    try {
      try {
        await auth.register(request);
      } catch (error) {
        if (mounted.current) {
          clearPasswords();

          setState({
            status: "error",
            message: createRegistrationErrorMessage(error),
          });
        }

        return;
      }

      try {
        const response = await auth.login({
          email: request.email,
          password: request.password,
        } satisfies LoginRequest);

        if (mounted.current) {
          onAuthenticated(createAuthSession(response));
        }
      } catch {
        if (mounted.current) {
          clearPasswords();

          setState({
            status: "login-required",
            message: AUTOMATIC_LOGIN_FAILED_MESSAGE,
          });
        }
      }
    } finally {
      submitInProgress.current = false;
    }
  }

  return (
    <section className="login-page shell" aria-labelledby="register-title">
      <div className="login-card">
        <p className="eyebrow">Nowe konto</p>

        <h1 id="register-title">Utwórz konto</h1>

        <p className="login-card__summary">
          Po rejestracji zalogujemy Cię automatycznie. Sesja pozostanie aktywna tylko do odświeżenia
          strony.
        </p>

        {state.status === "login-required" ? (
          <>
            <p className="login-form__error" role="alert">
              {state.message}
            </p>

            <a className="login-page__back" href="/login" data-app-link="true">
              Przejdź do logowania
            </a>
          </>
        ) : (
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
              Nazwa wyświetlana
              <input
                type="text"
                name="displayName"
                autoComplete="name"
                value={displayName}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setDisplayName(event.currentTarget.value);
                }}
              />
            </label>

            <label>
              Hasło
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setPassword(event.currentTarget.value);
                }}
              />
            </label>

            <label>
              Potwierdź hasło
              <input
                type="password"
                name="passwordConfirmation"
                autoComplete="new-password"
                value={passwordConfirmation}
                required
                disabled={isSubmitting}
                onChange={(event) => {
                  setPasswordConfirmation(event.currentTarget.value);
                }}
              />
            </label>

            {state.status === "error" && (
              <p className="login-form__error" role="alert">
                {state.message}
              </p>
            )}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Tworzenie konta…" : "Utwórz konto"}
            </button>
          </form>
        )}

        {state.status !== "login-required" && (
          <p>
            Masz już konto?{" "}
            <a href="/login" data-app-link="true">
              Przejdź do logowania
            </a>
          </p>
        )}

        <a className="login-page__back" href="/" data-app-link="true">
          Wróć do katalogu
        </a>
      </div>
    </section>
  );
}

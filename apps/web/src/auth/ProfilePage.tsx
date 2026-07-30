import type { AuthUserResponse, AuthUserRole } from "@ebookstore/contracts";
import { useEffect, useState } from "react";

import { ApiClientError } from "../api/api-client";

const PROFILE_LOAD_FAILED_MESSAGE = "Nie udało się pobrać profilu. Spróbuj ponownie.";

const roleLabels = {
  USER: "Użytkownik",
  ADMIN: "Administrator",
} satisfies Record<AuthUserRole, string>;

export interface ProfileApi {
  getCurrentUser(accessToken: string): Promise<AuthUserResponse>;
}

export interface ProfilePageProps {
  readonly accessToken: string;
  readonly auth: ProfileApi;
  readonly onSessionRejected: () => void;
}

type ProfileState =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "ready";
      readonly user: AuthUserResponse;
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

function formatCreatedAt(createdAt: string): string {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(timestamp);
}

function ProfileDetails({ user }: { readonly user: AuthUserResponse }) {
  const displayName = user.displayName?.trim() || "Nie ustawiono";

  return (
    <dl className="profile-details">
      <div>
        <dt>Nazwa wyświetlana</dt>
        <dd>{displayName}</dd>
      </div>

      <div>
        <dt>Adres e-mail</dt>
        <dd>{user.email}</dd>
      </div>

      <div>
        <dt>Rola konta</dt>
        <dd>{roleLabels[user.role]}</dd>
      </div>

      <div>
        <dt>Utworzono konto</dt>
        <dd>
          <time dateTime={user.createdAt}>{formatCreatedAt(user.createdAt)}</time>
        </dd>
      </div>
    </dl>
  );
}

export function ProfileAccessRequired() {
  return (
    <section className="profile-page shell" aria-labelledby="profile-access-title">
      <div className="profile-card profile-card--message">
        <p className="eyebrow">Dostęp chroniony</p>

        <h1 id="profile-access-title">Profil wymaga logowania</h1>

        <p className="profile-card__summary">Zaloguj się, aby pobrać aktualne dane konta.</p>

        <div className="profile-actions">
          <a href="/login" data-app-link="true">
            Przejdź do logowania
          </a>

          <a href="/" data-app-link="true">
            Wróć do katalogu
          </a>
        </div>
      </div>
    </section>
  );
}

export function ProfilePage({ accessToken, auth, onSessionRejected }: ProfilePageProps) {
  const [attempt, setAttempt] = useState(0);

  const [state, setState] = useState<ProfileState>({
    status: "loading",
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadProfile(): Promise<void> {
      try {
        const user = await auth.getCurrentUser(accessToken);

        if (isCurrent) {
          setState({
            status: "ready",
            user,
          });
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          onSessionRejected();

          return;
        }

        setState({
          status: "error",
          message: PROFILE_LOAD_FAILED_MESSAGE,
        });
      }
    }

    void loadProfile();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, attempt, auth, onSessionRejected]);

  function retry(): void {
    setState({
      status: "loading",
    });

    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  return (
    <section className="profile-page shell" aria-labelledby="profile-title">
      <div className="profile-card">
        <p className="eyebrow">Konto użytkownika</p>

        <h1 id="profile-title">Mój profil</h1>

        <p className="profile-card__summary">
          Dane są pobierane z chronionego endpointu uwierzytelnionego tokenem Bearer.
        </p>

        {state.status === "loading" && (
          <p className="profile-status" role="status">
            Pobieranie profilu…
          </p>
        )}

        {state.status === "error" && (
          <div className="profile-status profile-status--error" role="alert">
            <p>{state.message}</p>

            <button type="button" onClick={retry}>
              Spróbuj ponownie
            </button>
          </div>
        )}

        {state.status === "ready" && <ProfileDetails user={state.user} />}

        <div className="profile-actions">
          <a href="/" data-app-link="true">
            Wróć do katalogu
          </a>
        </div>
      </div>
    </section>
  );
}

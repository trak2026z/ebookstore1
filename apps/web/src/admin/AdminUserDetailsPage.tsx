import type { AdminUserListItem, AdminUserRole } from "@ebookstore/contracts";
import { useEffect, useState } from "react";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import { createAdminUsersPath } from "../navigation/browser-navigation";
import { AdminAccessDenied } from "./AdminUsersPage";

const ADMIN_USER_LOAD_FAILED_MESSAGE = "Nie udało się pobrać danych użytkownika. Spróbuj ponownie.";

const roleLabels = {
  USER: "Użytkownik",
  ADMIN: "Administrator",
} satisfies Record<AdminUserRole, string>;

type AdminUserDetailsState =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "ready";
      readonly user: AdminUserListItem;
    }
  | {
      readonly status: "forbidden";
    }
  | {
      readonly status: "not-found";
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

export interface AdminUserDetailsPageProps {
  readonly accessToken: string;
  readonly adminUsers: AdminUsersApi;
  readonly userId: string;
  readonly returnPage: number;
  readonly onSessionRejected: () => void;
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(timestamp);
}

function displayName(user: AdminUserListItem): string {
  return user.displayName?.trim() || "Nie ustawiono";
}

function AdminUserNotFound({ returnPage }: { readonly returnPage: number }) {
  return (
    <section className="admin-page shell" aria-labelledby="admin-user-not-found-title">
      <div className="admin-card admin-card--message">
        <p className="eyebrow">Błąd 404</p>

        <h1 id="admin-user-not-found-title">Nie znaleziono użytkownika</h1>

        <p className="admin-card__summary">
          Konto mogło zostać usunięte albo podany identyfikator jest nieprawidłowy.
        </p>

        <div className="admin-actions">
          <a href={createAdminUsersPath(returnPage)} data-app-link="true">
            Wróć do listy użytkowników
          </a>
        </div>
      </div>
    </section>
  );
}

function AdminUserDetails({ user }: { readonly user: AdminUserListItem }) {
  return (
    <dl className="admin-user-details">
      <div>
        <dt>Nazwa</dt>
        <dd>{displayName(user)}</dd>
      </div>
      <div>
        <dt>Adres e-mail</dt>
        <dd>{user.email}</dd>
      </div>
      <div>
        <dt>Rola</dt>
        <dd>{roleLabels[user.role]}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{user.isActive ? "Aktywne" : "Nieaktywne"}</dd>
      </div>
      <div>
        <dt>Utworzono</dt>
        <dd>
          <time dateTime={user.createdAt}>{formatDateTime(user.createdAt)}</time>
        </dd>
      </div>
      <div>
        <dt>Ostatnia aktualizacja</dt>
        <dd>
          <time dateTime={user.updatedAt}>{formatDateTime(user.updatedAt)}</time>
        </dd>
      </div>
      <div className="admin-user-details__identifier">
        <dt>Identyfikator</dt>
        <dd>{user.id}</dd>
      </div>
    </dl>
  );
}

export function AdminUserDetailsPage({
  accessToken,
  adminUsers,
  userId,
  returnPage,
  onSessionRejected,
}: AdminUserDetailsPageProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AdminUserDetailsState>({
    status: "loading",
  });

  useEffect(() => {
    let isCurrent = true;

    setState({
      status: "loading",
    });

    async function loadUser(): Promise<void> {
      try {
        const user = await adminUsers.getUser(accessToken, userId);

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

        if (error instanceof ApiClientError && error.status === 403) {
          setState({
            status: "forbidden",
          });

          return;
        }

        if (error instanceof ApiClientError && error.status === 404) {
          setState({
            status: "not-found",
          });

          return;
        }

        setState({
          status: "error",
          message: ADMIN_USER_LOAD_FAILED_MESSAGE,
        });
      }
    }

    void loadUser();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, adminUsers, attempt, onSessionRejected, userId]);

  if (state.status === "forbidden") {
    return <AdminAccessDenied />;
  }

  if (state.status === "not-found") {
    return <AdminUserNotFound returnPage={returnPage} />;
  }

  return (
    <section className="admin-page shell" aria-labelledby="admin-user-details-title">
      <div className="admin-card">
        <p className="eyebrow">Panel administratora</p>

        <h1 id="admin-user-details-title">Szczegóły użytkownika</h1>

        <p className="admin-card__summary">
          Dane konta pobrane z chronionego endpointu administratora.
        </p>

        {state.status === "loading" && (
          <p className="admin-status" role="status">
            Pobieranie danych użytkownika…
          </p>
        )}

        {state.status === "error" && (
          <div className="admin-status admin-status--error" role="alert">
            <p>{state.message}</p>

            <button
              type="button"
              onClick={() => {
                setAttempt((currentAttempt) => currentAttempt + 1);
              }}
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {state.status === "ready" && <AdminUserDetails user={state.user} />}

        <div className="admin-actions">
          <a href={createAdminUsersPath(returnPage)} data-app-link="true">
            Wróć do listy użytkowników
          </a>

          <a href="/" data-app-link="true">
            Wróć do katalogu
          </a>
        </div>
      </div>
    </section>
  );
}

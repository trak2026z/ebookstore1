import type {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserRole,
} from "@ebookstore/contracts";
import { useEffect, useState } from "react";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";

const ADMIN_USERS_QUERY = {
  page: 1,
  pageSize: 20,
} as const;

const ADMIN_USERS_LOAD_FAILED_MESSAGE = "Nie udało się pobrać użytkowników. Spróbuj ponownie.";

const roleLabels = {
  USER: "Użytkownik",
  ADMIN: "Administrator",
} satisfies Record<AdminUserRole, string>;

type AdminUsersState =
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "ready";
      readonly response: AdminUserListResponse;
    }
  | {
      readonly status: "forbidden";
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

export interface AdminUsersPageProps {
  readonly accessToken: string;
  readonly adminUsers: AdminUsersApi;
  readonly onSessionRejected: () => void;
}

function formatCreatedAt(createdAt: string): string {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(timestamp);
}

function displayName(user: AdminUserListItem): string {
  return user.displayName?.trim() || "Nie ustawiono";
}

function AdminUsersTable({ response }: { readonly response: AdminUserListResponse }) {
  return (
    <>
      <div className="admin-users-table-wrap">
        <table className="admin-users-table">
          <caption className="visually-hidden">Lista użytkowników sklepu</caption>
          <thead>
            <tr>
              <th scope="col">Nazwa</th>
              <th scope="col">Adres e-mail</th>
              <th scope="col">Rola</th>
              <th scope="col">Status</th>
              <th scope="col">Utworzono</th>
            </tr>
          </thead>
          <tbody>
            {response.items.map((user) => (
              <tr key={user.id}>
                <td>{displayName(user)}</td>
                <td>{user.email}</td>
                <td>{roleLabels[user.role]}</td>
                <td>
                  <span
                    className={
                      user.isActive
                        ? "admin-user-status admin-user-status--active"
                        : "admin-user-status admin-user-status--inactive"
                    }
                  >
                    {user.isActive ? "Aktywne" : "Nieaktywne"}
                  </span>
                </td>
                <td>
                  <time dateTime={user.createdAt}>{formatCreatedAt(user.createdAt)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-users-summary">
        Wyświetlono {response.items.length} z {response.pagination.total} kont.
      </p>
    </>
  );
}

export function AdminAccessRequired() {
  return (
    <section className="admin-page shell" aria-labelledby="admin-access-title">
      <div className="admin-card admin-card--message">
        <p className="eyebrow">Dostęp chroniony</p>

        <h1 id="admin-access-title">Panel administratora wymaga logowania</h1>

        <p className="admin-card__summary">
          Zaloguj się na konto administratora, aby zarządzać użytkownikami.
        </p>

        <div className="admin-actions">
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

export function AdminAccessDenied() {
  return (
    <section className="admin-page shell" aria-labelledby="admin-denied-title">
      <div className="admin-card admin-card--message">
        <p className="eyebrow">Brak uprawnień</p>

        <h1 id="admin-denied-title">Brak dostępu do panelu administratora</h1>

        <p className="admin-card__summary">
          To konto nie ma uprawnień do zarządzania użytkownikami.
        </p>

        <div className="admin-actions">
          <a href="/" data-app-link="true">
            Wróć do katalogu
          </a>
        </div>
      </div>
    </section>
  );
}

export function AdminUsersPage({
  accessToken,
  adminUsers,
  onSessionRejected,
}: AdminUsersPageProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AdminUsersState>({
    status: "loading",
  });

  useEffect(() => {
    let isCurrent = true;

    async function loadUsers(): Promise<void> {
      try {
        const response = await adminUsers.listUsers(accessToken, ADMIN_USERS_QUERY);

        if (isCurrent) {
          setState({
            status: "ready",
            response,
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

        setState({
          status: "error",
          message: ADMIN_USERS_LOAD_FAILED_MESSAGE,
        });
      }
    }

    void loadUsers();

    return () => {
      isCurrent = false;
    };
  }, [accessToken, adminUsers, attempt, onSessionRejected]);

  function retry(): void {
    setState({
      status: "loading",
    });
    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  if (state.status === "forbidden") {
    return <AdminAccessDenied />;
  }

  return (
    <section className="admin-page shell" aria-labelledby="admin-users-title">
      <div className="admin-card">
        <p className="eyebrow">Panel administratora</p>

        <h1 id="admin-users-title">Użytkownicy</h1>

        <p className="admin-card__summary">
          Lista kont pobrana z chronionego endpointu administratora.
        </p>

        {state.status === "loading" && (
          <p className="admin-status" role="status">
            Pobieranie użytkowników…
          </p>
        )}

        {state.status === "error" && (
          <div className="admin-status admin-status--error" role="alert">
            <p>{state.message}</p>

            <button type="button" onClick={retry}>
              Spróbuj ponownie
            </button>
          </div>
        )}

        {state.status === "ready" &&
          (state.response.items.length > 0 ? (
            <AdminUsersTable response={state.response} />
          ) : (
            <p className="admin-status">Brak użytkowników do wyświetlenia.</p>
          ))}

        <div className="admin-actions">
          <a href="/" data-app-link="true">
            Wróć do katalogu
          </a>
        </div>
      </div>
    </section>
  );
}

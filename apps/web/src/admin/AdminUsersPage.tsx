import type {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserRole,
} from "@ebookstore/contracts";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import type { AdminUserListQuery, AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import {
  createAdminUserPath,
  createAdminUsersPath,
  type AdminUserRoleFilter,
  type AdminUsersRouteQuery,
  type AdminUserStatusFilter,
} from "../navigation/browser-navigation";

const ADMIN_USERS_PAGE_SIZE = 20;

const ADMIN_USERS_LOAD_FAILED_MESSAGE = "Nie udało się pobrać użytkowników. Spróbuj ponownie.";

const roleLabels = {
  USER: "Użytkownik",
  ADMIN: "Administrator",
} satisfies Record<AdminUserRole, string>;

interface AdminUsersFilterValues {
  readonly query: string;
  readonly role: AdminUserRoleFilter;
  readonly status: AdminUserStatusFilter;
}

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
  readonly routeQuery: AdminUsersRouteQuery;
  readonly onNavigate: (path: string) => void;
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

function filterValuesFromRoute(routeQuery: AdminUsersRouteQuery): AdminUsersFilterValues {
  return {
    query: routeQuery.query,
    role: routeQuery.role,
    status: routeQuery.status,
  };
}

function hasActiveFilters(routeQuery: AdminUsersRouteQuery): boolean {
  return Boolean(routeQuery.query || routeQuery.role || routeQuery.status);
}

function toApiQuery(routeQuery: AdminUsersRouteQuery): AdminUserListQuery {
  return {
    page: routeQuery.page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
    ...(routeQuery.query
      ? {
          query: routeQuery.query,
        }
      : {}),
    ...(routeQuery.role
      ? {
          role: routeQuery.role,
        }
      : {}),
    ...(routeQuery.status
      ? {
          status: routeQuery.status,
        }
      : {}),
  };
}

function PaginationControl({
  enabled,
  href,
  label,
}: {
  readonly enabled: boolean;
  readonly href: string;
  readonly label: string;
}) {
  return enabled ? (
    <a href={href} data-app-link="true">
      {label}
    </a>
  ) : (
    <button type="button" disabled>
      {label}
    </button>
  );
}

function AdminUsersPagination({
  response,
  routeQuery,
}: {
  readonly response: AdminUserListResponse;
  readonly routeQuery: AdminUsersRouteQuery;
}) {
  const currentPage = response.pagination.page;
  const totalPages = Math.max(response.pagination.totalPages, 1);

  return (
    <nav className="admin-pagination" aria-label="Paginacja użytkowników">
      <PaginationControl
        enabled={currentPage > 1}
        href={createAdminUsersPath({
          ...routeQuery,
          page: Math.max(currentPage - 1, 1),
        })}
        label="Poprzednia"
      />

      <span className="admin-pagination__summary" aria-live="polite">
        Strona {currentPage} z {totalPages}
      </span>

      <PaginationControl
        enabled={currentPage < response.pagination.totalPages}
        href={createAdminUsersPath({
          ...routeQuery,
          page: currentPage + 1,
        })}
        label="Następna"
      />
    </nav>
  );
}

function AdminUsersFilters({
  values,
  hasAppliedFilters,
  onChange,
  onApply,
  onClear,
}: {
  readonly values: AdminUsersFilterValues;
  readonly hasAppliedFilters: boolean;
  readonly onChange: (values: AdminUsersFilterValues) => void;
  readonly onApply: () => void;
  readonly onClear: () => void;
}) {
  function updateValues(patch: Partial<AdminUsersFilterValues>): void {
    onChange({
      ...values,
      ...patch,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onApply();
  }

  return (
    <form className="admin-user-filters" aria-label="Filtry użytkowników" onSubmit={handleSubmit}>
      <div className="admin-user-filters__grid">
        <label>
          <span>Szukaj</span>
          <input
            type="search"
            name="query"
            value={values.query}
            maxLength={100}
            placeholder="Nazwa lub adres e-mail"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateValues({
                query: event.currentTarget.value,
              });
            }}
          />
        </label>

        <label>
          <span>Rola</span>
          <select
            name="role"
            value={values.role}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                role: event.currentTarget.value as AdminUserRoleFilter,
              });
            }}
          >
            <option value="">Wszystkie role</option>
            <option value="USER">Użytkownik</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            name="status"
            value={values.status}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                status: event.currentTarget.value as AdminUserStatusFilter,
              });
            }}
          >
            <option value="">Wszystkie statusy</option>
            <option value="active">Aktywne</option>
            <option value="inactive">Nieaktywne</option>
          </select>
        </label>
      </div>

      <div className="admin-user-filters__actions">
        <button type="submit">Zastosuj filtry</button>
        <button
          type="button"
          disabled={!hasAppliedFilters && !values.query && !values.role && !values.status}
          onClick={onClear}
        >
          Wyczyść filtry
        </button>
      </div>
    </form>
  );
}

function AdminUsersTable({
  response,
  routeQuery,
}: {
  readonly response: AdminUserListResponse;
  readonly routeQuery: AdminUsersRouteQuery;
}) {
  const returnQuery = {
    ...routeQuery,
    page: response.pagination.page,
  };

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
              <th scope="col">Akcje</th>
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
                <td>
                  <a
                    className="admin-user-details-link"
                    href={createAdminUserPath(user.id, returnQuery)}
                    aria-label={`Szczegóły: ${user.email}`}
                    data-app-link="true"
                  >
                    Szczegóły
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="admin-users-summary">
        Wyświetlono {response.items.length} z {response.pagination.total} kont.
      </p>

      <AdminUsersPagination response={response} routeQuery={routeQuery} />
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
  routeQuery,
  onNavigate,
  onSessionRejected,
}: AdminUsersPageProps) {
  const [attempt, setAttempt] = useState(0);
  const [draftFilters, setDraftFilters] = useState<AdminUsersFilterValues>(() =>
    filterValuesFromRoute(routeQuery),
  );
  const [state, setState] = useState<AdminUsersState>({
    status: "loading",
  });

  useEffect(() => {
    setDraftFilters(filterValuesFromRoute(routeQuery));
  }, [routeQuery.query, routeQuery.role, routeQuery.status]);

  useEffect(() => {
    let isCurrent = true;

    setState({
      status: "loading",
    });

    async function loadUsers(): Promise<void> {
      try {
        const response = await adminUsers.listUsers(accessToken, toApiQuery(routeQuery));

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
  }, [
    accessToken,
    adminUsers,
    attempt,
    onSessionRejected,
    routeQuery.page,
    routeQuery.query,
    routeQuery.role,
    routeQuery.status,
  ]);

  function retry(): void {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  function applyFilters(): void {
    onNavigate(
      createAdminUsersPath({
        page: 1,
        query: draftFilters.query,
        role: draftFilters.role,
        status: draftFilters.status,
      }),
    );
  }

  function clearFilters(): void {
    setDraftFilters({
      query: "",
      role: "",
      status: "",
    });
    onNavigate(createAdminUsersPath());
  }

  if (state.status === "forbidden") {
    return <AdminAccessDenied />;
  }

  const filtersApplied = hasActiveFilters(routeQuery);

  return (
    <section className="admin-page shell" aria-labelledby="admin-users-title">
      <div className="admin-card">
        <p className="eyebrow">Panel administratora</p>

        <h1 id="admin-users-title">Użytkownicy</h1>

        <p className="admin-card__summary">Wyszukuj konta oraz filtruj je według roli i statusu.</p>

        <AdminUsersFilters
          values={draftFilters}
          hasAppliedFilters={filtersApplied}
          onChange={setDraftFilters}
          onApply={applyFilters}
          onClear={clearFilters}
        />

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
            <AdminUsersTable response={state.response} routeQuery={routeQuery} />
          ) : (
            <>
              <p className="admin-status">
                {filtersApplied
                  ? "Brak użytkowników spełniających wybrane kryteria."
                  : "Brak użytkowników do wyświetlenia."}
              </p>
              <AdminUsersPagination response={state.response} routeQuery={routeQuery} />
            </>
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

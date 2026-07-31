import type { AdminUserListItem, AdminUserRole } from "@ebookstore/contracts";
import { useEffect, useRef, useState } from "react";

import type { AdminUsersApi } from "../api/admin-users-api";
import { ApiClientError } from "../api/api-client";
import { createAdminUsersPath, type AdminUsersRouteQuery } from "../navigation/browser-navigation";
import {
  AdminUserManagement,
  type AdminUserActionState,
  type PendingAdminUserAction,
} from "./AdminUserManagement";
import { AdminAccessDenied } from "./AdminUsersPage";

const ADMIN_USER_LOAD_FAILED_MESSAGE = "Nie udało się pobrać danych użytkownika. Spróbuj ponownie.";

const ADMIN_USER_ROLE_UPDATE_FAILED_MESSAGE =
  "Nie udało się zmienić roli użytkownika. Spróbuj ponownie.";

const ADMIN_USER_STATUS_UPDATE_FAILED_MESSAGE =
  "Nie udało się zmienić statusu użytkownika. Spróbuj ponownie.";

const ADMIN_USER_CONFLICT_MESSAGE =
  "Nie można wykonać tej operacji. Konto musi zachować bezpieczne uprawnienia administratora.";

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
  readonly currentUserId: string;
  readonly userId: string;
  readonly returnQuery: AdminUsersRouteQuery;
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

function actionSuccessMessage(action: PendingAdminUserAction): string {
  return action.kind === "role"
    ? "Rola użytkownika została zmieniona."
    : "Status użytkownika został zmieniony.";
}

function actionFailureMessage(action: PendingAdminUserAction, error: unknown): string {
  if (error instanceof ApiClientError && error.status === 409) {
    return ADMIN_USER_CONFLICT_MESSAGE;
  }

  return action.kind === "role"
    ? ADMIN_USER_ROLE_UPDATE_FAILED_MESSAGE
    : ADMIN_USER_STATUS_UPDATE_FAILED_MESSAGE;
}

function AdminUserNotFound({ returnQuery }: { readonly returnQuery: AdminUsersRouteQuery }) {
  return (
    <section className="admin-page shell" aria-labelledby="admin-user-not-found-title">
      <div className="admin-card admin-card--message">
        <p className="eyebrow">Błąd 404</p>

        <h1 id="admin-user-not-found-title">Nie znaleziono użytkownika</h1>

        <p className="admin-card__summary">
          Konto mogło zostać usunięte albo podany identyfikator jest nieprawidłowy.
        </p>

        <div className="admin-actions">
          <a href={createAdminUsersPath(returnQuery)} data-app-link="true">
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
  currentUserId,
  userId,
  returnQuery,
  onSessionRejected,
}: AdminUserDetailsPageProps) {
  const isMounted = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AdminUserDetailsState>({
    status: "loading",
  });
  const [actionState, setActionState] = useState<AdminUserActionState>({
    status: "idle",
  });

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    setState({
      status: "loading",
    });
    setActionState({
      status: "idle",
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

  function requestRoleChange(role: AdminUserRole): void {
    if (state.status !== "ready" || state.user.id === currentUserId) {
      return;
    }

    setActionState({
      status: "confirming",
      action: {
        kind: "role",
        nextRole: role,
      },
    });
  }

  function requestStatusChange(isActive: boolean): void {
    if (state.status !== "ready" || state.user.id === currentUserId) {
      return;
    }

    setActionState({
      status: "confirming",
      action: {
        kind: "status",
        nextIsActive: isActive,
      },
    });
  }

  async function confirmAction(): Promise<void> {
    if (
      state.status !== "ready" ||
      actionState.status !== "confirming" ||
      state.user.id === currentUserId
    ) {
      return;
    }

    const action = actionState.action;

    setActionState({
      status: "submitting",
      action,
    });

    try {
      const updatedUser =
        action.kind === "role"
          ? await adminUsers.updateUserRole(accessToken, state.user.id, action.nextRole)
          : await adminUsers.updateUserStatus(accessToken, state.user.id, action.nextIsActive);

      if (!isMounted.current) {
        return;
      }

      setState({
        status: "ready",
        user: updatedUser,
      });
      setActionState({
        status: "success",
        message: actionSuccessMessage(action),
      });
    } catch (error) {
      if (!isMounted.current) {
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

      setActionState({
        status: "error",
        message: actionFailureMessage(action, error),
      });
    }
  }

  if (state.status === "forbidden") {
    return <AdminAccessDenied />;
  }

  if (state.status === "not-found") {
    return <AdminUserNotFound returnQuery={returnQuery} />;
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

        {state.status === "ready" && (
          <>
            <AdminUserDetails user={state.user} />

            <AdminUserManagement
              user={state.user}
              isCurrentUser={state.user.id === currentUserId}
              actionState={actionState}
              onRequestRole={requestRoleChange}
              onRequestStatus={requestStatusChange}
              onCancel={() => {
                setActionState({
                  status: "idle",
                });
              }}
              onConfirm={() => {
                void confirmAction();
              }}
            />
          </>
        )}

        <div className="admin-actions">
          <a href={createAdminUsersPath(returnQuery)} data-app-link="true">
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

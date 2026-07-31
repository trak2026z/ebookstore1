import type { AdminUserListItem, AdminUserRole } from "@ebookstore/contracts";

const roleLabels = {
  USER: "Użytkownik",
  ADMIN: "Administrator",
} satisfies Record<AdminUserRole, string>;

export type PendingAdminUserAction =
  | {
      readonly kind: "role";
      readonly nextRole: AdminUserRole;
    }
  | {
      readonly kind: "status";
      readonly nextIsActive: boolean;
    };

export type AdminUserActionState =
  | {
      readonly status: "idle";
    }
  | {
      readonly status: "confirming";
      readonly action: PendingAdminUserAction;
    }
  | {
      readonly status: "submitting";
      readonly action: PendingAdminUserAction;
    }
  | {
      readonly status: "success";
      readonly message: string;
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

function actionDescription(action: PendingAdminUserAction, user: AdminUserListItem): string {
  if (action.kind === "role") {
    return `Zmienić rolę konta ${user.email} na ${roleLabels[action.nextRole].toLowerCase()}?`;
  }

  return action.nextIsActive
    ? `Aktywować konto ${user.email}?`
    : `Dezaktywować konto ${user.email}?`;
}

export function AdminUserManagement({
  user,
  isCurrentUser,
  actionState,
  onRequestRole,
  onRequestStatus,
  onCancel,
  onConfirm,
}: {
  readonly user: AdminUserListItem;
  readonly isCurrentUser: boolean;
  readonly actionState: AdminUserActionState;
  readonly onRequestRole: (role: AdminUserRole) => void;
  readonly onRequestStatus: (isActive: boolean) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const isInteractionLocked =
    isCurrentUser || actionState.status === "confirming" || actionState.status === "submitting";

  const nextRole: AdminUserRole = user.role === "ADMIN" ? "USER" : "ADMIN";

  return (
    <section
      className="admin-user-management"
      aria-labelledby="admin-user-management-title"
      aria-busy={actionState.status === "submitting"}
    >
      <h2 id="admin-user-management-title">Zarządzanie kontem</h2>

      <p className="admin-user-management__summary">
        Zmiany są zapisywane dopiero po potwierdzeniu.
      </p>

      {isCurrentUser && (
        <p className="admin-user-management__self-notice">
          Nie możesz zmienić własnej roli ani dezaktywować własnego konta administratora.
        </p>
      )}

      <div className="admin-user-management__controls">
        <button
          type="button"
          disabled={isInteractionLocked}
          onClick={() => {
            onRequestRole(nextRole);
          }}
        >
          {nextRole === "ADMIN" ? "Nadaj rolę administratora" : "Zmień rolę na użytkownika"}
        </button>

        <button
          type="button"
          disabled={isInteractionLocked}
          onClick={() => {
            onRequestStatus(!user.isActive);
          }}
        >
          {user.isActive ? "Dezaktywuj konto" : "Aktywuj konto"}
        </button>
      </div>

      {actionState.status === "confirming" && (
        <div
          className="admin-user-confirmation"
          role="alertdialog"
          aria-labelledby="admin-user-confirmation-title"
          aria-describedby="admin-user-confirmation-description"
        >
          <h3 id="admin-user-confirmation-title">Potwierdź zmianę</h3>

          <p id="admin-user-confirmation-description">
            {actionDescription(actionState.action, user)}
          </p>

          <div className="admin-user-confirmation__actions">
            <button type="button" onClick={onConfirm}>
              Potwierdź zmianę
            </button>

            <button type="button" onClick={onCancel}>
              Anuluj
            </button>
          </div>
        </div>
      )}

      {actionState.status === "submitting" && (
        <p className="admin-status" role="status">
          Zapisywanie zmiany…
        </p>
      )}

      {actionState.status === "success" && (
        <p
          className="admin-user-management__feedback admin-user-management__feedback--success"
          role="status"
        >
          {actionState.message}
        </p>
      )}

      {actionState.status === "error" && (
        <p
          className="admin-user-management__feedback admin-user-management__feedback--error"
          role="alert"
        >
          {actionState.message}
        </p>
      )}
    </section>
  );
}

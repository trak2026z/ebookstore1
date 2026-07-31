export type AdminUserRoleFilter = "" | "USER" | "ADMIN";
export type AdminUserStatusFilter = "" | "active" | "inactive";

export interface AdminUsersRouteQuery {
  readonly page: number;
  readonly query: string;
  readonly role: AdminUserRoleFilter;
  readonly status: AdminUserStatusFilter;
}

export type AppRoute =
  | { readonly name: "catalog" }
  | { readonly name: "login" }
  | { readonly name: "register" }
  | { readonly name: "profile" }
  | {
      readonly name: "admin-users";
      readonly query: AdminUsersRouteQuery;
    }
  | {
      readonly name: "admin-user-details";
      readonly userId: string;
      readonly returnQuery: AdminUsersRouteQuery;
    }
  | {
      readonly name: "book-details";
      readonly slug: string;
    }
  | { readonly name: "not-found" };

const APP_LINK_SELECTOR = 'a[data-app-link="true"]';

export const EMPTY_ADMIN_USERS_QUERY: AdminUsersRouteQuery = {
  page: 1,
  query: "",
  role: "",
  status: "",
};

function normalizePositivePage(page: number): number {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError("Page must be a positive integer.");
  }

  return page;
}

function normalizeRole(role: AdminUserRoleFilter): AdminUserRoleFilter {
  if (role !== "" && role !== "USER" && role !== "ADMIN") {
    throw new TypeError("Role filter is invalid.");
  }

  return role;
}

function normalizeStatus(status: AdminUserStatusFilter): AdminUserStatusFilter {
  if (status !== "" && status !== "active" && status !== "inactive") {
    throw new TypeError("Status filter is invalid.");
  }

  return status;
}

function readPage(parameters: URLSearchParams): number {
  const value = parameters.get("page");

  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function readRole(parameters: URLSearchParams): AdminUserRoleFilter {
  const value = parameters.get("role");

  return value === "USER" || value === "ADMIN" ? value : "";
}

function readStatus(parameters: URLSearchParams): AdminUserStatusFilter {
  const value = parameters.get("status");

  return value === "active" || value === "inactive" ? value : "";
}

function readAdminUsersQuery(search: string): AdminUsersRouteQuery {
  const parameters = new URLSearchParams(search);

  return {
    page: readPage(parameters),
    query: parameters.get("query")?.trim() ?? "",
    role: readRole(parameters),
    status: readStatus(parameters),
  };
}

function decodeRequiredPathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return null;
  }
}

export function createBookPath(slug: string): string {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new TypeError("Book slug must not be empty.");
  }

  return `/books/${encodeURIComponent(normalizedSlug)}`;
}

export function createAdminUsersPath(
  query: AdminUsersRouteQuery = EMPTY_ADMIN_USERS_QUERY,
): string {
  const parameters = new URLSearchParams();
  const page = normalizePositivePage(query.page);
  const normalizedQuery = query.query.trim();
  const role = normalizeRole(query.role);
  const status = normalizeStatus(query.status);

  if (page > 1) {
    parameters.set("page", String(page));
  }

  if (normalizedQuery) {
    parameters.set("query", normalizedQuery);
  }

  if (role) {
    parameters.set("role", role);
  }

  if (status) {
    parameters.set("status", status);
  }

  const queryString = parameters.toString();

  return queryString ? `/admin/users?${queryString}` : "/admin/users";
}

export function createAdminUserPath(
  userId: string,
  returnQuery: AdminUsersRouteQuery = EMPTY_ADMIN_USERS_QUERY,
): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new TypeError("User ID must not be empty.");
  }

  const listPath = createAdminUsersPath(returnQuery);
  const search = listPath.slice("/admin/users".length);

  return `/admin/users/${encodeURIComponent(normalizedUserId)}${search}`;
}

export function readBrowserRoute(
  pathname = window.location.pathname,
  search = window.location.search,
): AppRoute {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPathname === "/") {
    return {
      name: "catalog",
    };
  }

  if (normalizedPathname === "/login") {
    return {
      name: "login",
    };
  }

  if (normalizedPathname === "/register") {
    return {
      name: "register",
    };
  }

  if (normalizedPathname === "/profile") {
    return {
      name: "profile",
    };
  }

  if (normalizedPathname === "/admin/users") {
    return {
      name: "admin-users",
      query: readAdminUsersQuery(search),
    };
  }

  const adminUserMatch = /^\/admin\/users\/([^/]+)$/.exec(normalizedPathname);

  if (adminUserMatch) {
    const userId = decodeRequiredPathSegment(adminUserMatch[1] ?? "");

    return userId
      ? {
          name: "admin-user-details",
          userId,
          returnQuery: readAdminUsersQuery(search),
        }
      : {
          name: "not-found",
        };
  }

  const bookMatch = /^\/books\/([^/]+)$/.exec(normalizedPathname);

  if (!bookMatch) {
    return {
      name: "not-found",
    };
  }

  const slug = decodeRequiredPathSegment(bookMatch[1] ?? "");

  return slug
    ? {
        name: "book-details",
        slug,
      }
    : {
        name: "not-found",
      };
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function findAppLink(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest<HTMLAnchorElement>(APP_LINK_SELECTOR) : null;
}

export function installBrowserNavigation(onRouteChange: (route: AppRoute) => void): () => void {
  function notifyRouteChange(): void {
    onRouteChange(readBrowserRoute());
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (event.defaultPrevented || !isPlainPrimaryClick(event)) {
      return;
    }

    const link = findAppLink(event.target);

    if (
      !link ||
      link.target ||
      link.hasAttribute("download") ||
      link.origin !== window.location.origin
    ) {
      return;
    }

    event.preventDefault();

    const nextLocation = `${link.pathname}` + `${link.search}` + `${link.hash}`;

    const currentLocation =
      `${window.location.pathname}` + `${window.location.search}` + `${window.location.hash}`;

    if (nextLocation !== currentLocation) {
      window.history.pushState(null, "", nextLocation);
    }

    notifyRouteChange();
  }

  window.addEventListener("popstate", notifyRouteChange);
  document.addEventListener("click", handleDocumentClick);

  return () => {
    window.removeEventListener("popstate", notifyRouteChange);
    document.removeEventListener("click", handleDocumentClick);
  };
}

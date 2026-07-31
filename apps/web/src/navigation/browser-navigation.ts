export type AppRoute =
  | { readonly name: "catalog" }
  | { readonly name: "login" }
  | { readonly name: "register" }
  | { readonly name: "profile" }
  | {
      readonly name: "admin-users";
      readonly page: number;
    }
  | {
      readonly name: "admin-user-details";
      readonly userId: string;
      readonly returnPage: number;
    }
  | {
      readonly name: "book-details";
      readonly slug: string;
    }
  | { readonly name: "not-found" };

const APP_LINK_SELECTOR = 'a[data-app-link="true"]';

function normalizePositivePage(page: number): number {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new TypeError("Page must be a positive integer.");
  }

  return page;
}

function readPage(search: string): number {
  const value = new URLSearchParams(search).get("page");

  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);

  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
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

export function createAdminUsersPath(page: number): string {
  const normalizedPage = normalizePositivePage(page);

  return normalizedPage === 1 ? "/admin/users" : `/admin/users?page=${normalizedPage}`;
}

export function createAdminUserPath(userId: string, returnPage = 1): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new TypeError("User ID must not be empty.");
  }

  const listPath = createAdminUsersPath(returnPage);
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
      page: readPage(search),
    };
  }

  const adminUserMatch = /^\/admin\/users\/([^/]+)$/.exec(normalizedPathname);

  if (adminUserMatch) {
    const userId = decodeRequiredPathSegment(adminUserMatch[1] ?? "");

    return userId
      ? {
          name: "admin-user-details",
          userId,
          returnPage: readPage(search),
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

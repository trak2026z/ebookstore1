export type AppRoute =
  | { readonly name: "catalog" }
  | { readonly name: "login" }
  | {
      readonly name: "book-details";
      readonly slug: string;
    }
  | { readonly name: "not-found" };

const APP_LINK_SELECTOR = 'a[data-app-link="true"]';

export function createBookPath(slug: string): string {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    throw new TypeError("Book slug must not be empty.");
  }

  return `/books/${encodeURIComponent(normalizedSlug)}`;
}

export function readBrowserRoute(pathname = window.location.pathname): AppRoute {
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

  const match = /^\/books\/([^/]+)$/.exec(normalizedPathname);

  if (!match) {
    return {
      name: "not-found",
    };
  }

  try {
    const slug = decodeURIComponent(match[1] ?? "").trim();

    return slug
      ? {
          name: "book-details",
          slug,
        }
      : {
          name: "not-found",
        };
  } catch {
    return {
      name: "not-found",
    };
  }
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

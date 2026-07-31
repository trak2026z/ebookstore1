import { useCallback, useEffect, useState } from "react";

import { adminUsersApi, type AdminUsersApi } from "./api/admin-users-api";
import { authApi } from "./api/auth-api";
import { catalogApi } from "./api/catalog-api";
import { AdminUserDetailsPage } from "./admin/AdminUserDetailsPage";
import { AdminAccessDenied, AdminAccessRequired, AdminUsersPage } from "./admin/AdminUsersPage";
import { LoginPage } from "./auth/LoginPage";
import { ProfileAccessRequired, ProfilePage, type ProfileApi } from "./auth/ProfilePage";
import { RegisterPage, type RegistrationApi } from "./auth/RegisterPage";
import type { AuthSession } from "./auth/auth-session";
import { scheduleSessionExpiry } from "./auth/session-expiry";
import { BookDetails, type BookDetailsApi } from "./catalog/BookDetails";
import { CatalogPage, type CatalogBooksApi } from "./catalog/CatalogPage";
import {
  installBrowserNavigation,
  readBrowserRoute,
  type AppRoute,
} from "./navigation/browser-navigation";

export interface AppCatalogApi extends CatalogBooksApi, BookDetailsApi {}

export interface AppProps {
  readonly catalog?: AppCatalogApi;
  readonly auth?: RegistrationApi;
  readonly profile?: ProfileApi;
  readonly adminUsers?: AdminUsersApi;
}

function CatalogHero() {
  return (
    <section className="hero shell" aria-labelledby="page-title">
      <p className="eyebrow">Publiczny katalog e-booków</p>

      <h1 id="page-title">Ebookstore</h1>

      <p className="hero__summary">
        Przeglądaj dostępne książki i przechodź między stronami katalogu.
      </p>
    </section>
  );
}

function UnknownRoute() {
  return (
    <section className="app-not-found shell" aria-labelledby="not-found-title">
      <p className="eyebrow">Błąd 404</p>

      <h1 id="not-found-title">Nie znaleziono strony</h1>

      <p>Podany adres nie prowadzi do dostępnego widoku.</p>

      <a href="/" data-app-link="true">
        Wróć do katalogu
      </a>
    </section>
  );
}

function MainContent({
  route,
  catalog,
  auth,
  profile,
  adminUsers,
  authSession,
  onAuthenticated,
  onNavigate,
  onSessionRejected,
}: {
  readonly route: AppRoute;
  readonly catalog: AppCatalogApi;
  readonly auth: RegistrationApi;
  readonly profile: ProfileApi;
  readonly adminUsers: AdminUsersApi;
  readonly authSession: AuthSession | null;
  readonly onAuthenticated: (session: AuthSession) => void;
  readonly onNavigate: (path: string) => void;
  readonly onSessionRejected: () => void;
}) {
  if (route.name === "book-details") {
    return <BookDetails slug={route.slug} catalog={catalog} />;
  }

  if (route.name === "login") {
    return <LoginPage auth={auth} onAuthenticated={onAuthenticated} />;
  }

  if (route.name === "register") {
    return <RegisterPage auth={auth} onAuthenticated={onAuthenticated} />;
  }

  if (route.name === "profile") {
    return authSession ? (
      <ProfilePage
        accessToken={authSession.accessToken}
        auth={profile}
        onSessionRejected={onSessionRejected}
      />
    ) : (
      <ProfileAccessRequired />
    );
  }

  if (route.name === "admin-users" || route.name === "admin-user-details") {
    if (!authSession) {
      return <AdminAccessRequired />;
    }

    if (authSession.user.role !== "ADMIN") {
      return <AdminAccessDenied />;
    }

    return route.name === "admin-users" ? (
      <AdminUsersPage
        accessToken={authSession.accessToken}
        adminUsers={adminUsers}
        routeQuery={route.query}
        onNavigate={onNavigate}
        onSessionRejected={onSessionRejected}
      />
    ) : (
      <AdminUserDetailsPage
        accessToken={authSession.accessToken}
        adminUsers={adminUsers}
        currentUserId={authSession.user.id}
        userId={route.userId}
        returnQuery={route.returnQuery}
        onSessionRejected={onSessionRejected}
      />
    );
  }

  if (route.name === "not-found") {
    return <UnknownRoute />;
  }

  return (
    <>
      <CatalogHero />
      <CatalogPage catalog={catalog} />
    </>
  );
}

export default function App({
  catalog = catalogApi,
  auth = authApi,
  profile = authApi,
  adminUsers = adminUsersApi,
}: AppProps) {
  const [route, setRoute] = useState<AppRoute>(readBrowserRoute);

  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  useEffect(() => installBrowserNavigation(setRoute), []);

  const navigateTo = useCallback((path: string): void => {
    const nextUrl = new URL(path, window.location.origin);

    if (nextUrl.origin !== window.location.origin) {
      throw new TypeError("Application navigation must stay on the current origin.");
    }

    const nextLocation = `${nextUrl.pathname}` + `${nextUrl.search}` + `${nextUrl.hash}`;
    const currentLocation =
      `${window.location.pathname}` + `${window.location.search}` + `${window.location.hash}`;

    if (nextLocation !== currentLocation) {
      window.history.pushState(null, "", nextLocation);
    }

    setRoute(readBrowserRoute());
  }, []);

  const navigateToCatalog = useCallback((): void => {
    navigateTo("/");
  }, [navigateTo]);

  const clearAuthSession = useCallback((): void => {
    setAuthSession(null);
  }, []);

  const handleAuthenticated = useCallback(
    (session: AuthSession): void => {
      setAuthSession(session);
      navigateToCatalog();
    },
    [navigateToCatalog],
  );

  const handleLogout = useCallback((): void => {
    clearAuthSession();
    navigateToCatalog();
  }, [clearAuthSession, navigateToCatalog]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    return scheduleSessionExpiry(authSession.expiresAt, clearAuthSession);
  }, [authSession, clearAuthSession]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Przejdź do treści
      </a>

      <header className="site-header">
        <div className="shell site-header__content">
          <a
            className="brand"
            href="/"
            aria-label="Ebookstore — strona główna"
            data-app-link="true"
          >
            Ebookstore
          </a>

          <div className="site-header__actions">
            <span className="stage-badge">Publiczny katalog</span>

            <nav className="site-header__account-controls" aria-label="Konto użytkownika">
              {authSession ? (
                <>
                  {authSession.user.role === "ADMIN" && (
                    <a className="site-header__admin-link" href="/admin/users" data-app-link="true">
                      Użytkownicy
                    </a>
                  )}

                  <a
                    className="site-header__account"
                    href="/profile"
                    aria-label={`Zalogowano jako ${authSession.user.email}`}
                    data-app-link="true"
                  >
                    {authSession.user.email}
                  </a>

                  <button className="site-header__logout" type="button" onClick={handleLogout}>
                    Wyloguj się
                  </button>
                </>
              ) : (
                <a className="site-header__auth-link" href="/login" data-app-link="true">
                  Zaloguj się
                </a>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content">
        <MainContent
          route={route}
          catalog={catalog}
          auth={auth}
          profile={profile}
          adminUsers={adminUsers}
          authSession={authSession}
          onAuthenticated={handleAuthenticated}
          onNavigate={navigateTo}
          onSessionRejected={clearAuthSession}
        />
      </main>

      <footer className="site-footer">
        <div className="shell">Ebookstore — wersja developerska</div>
      </footer>
    </>
  );
}

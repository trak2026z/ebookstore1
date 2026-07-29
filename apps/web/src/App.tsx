import { useEffect, useState } from "react";

import { authApi } from "./api/auth-api";
import { catalogApi } from "./api/catalog-api";
import { LoginPage, type LoginApi } from "./auth/LoginPage";
import type { AuthSession } from "./auth/auth-session";
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
  readonly auth?: LoginApi;
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
  onAuthenticated,
}: {
  readonly route: AppRoute;
  readonly catalog: AppCatalogApi;
  readonly auth: LoginApi;
  readonly onAuthenticated: (session: AuthSession) => void;
}) {
  if (route.name === "book-details") {
    return <BookDetails slug={route.slug} catalog={catalog} />;
  }

  if (route.name === "login") {
    return <LoginPage auth={auth} onAuthenticated={onAuthenticated} />;
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

export default function App({ catalog = catalogApi, auth = authApi }: AppProps) {
  const [route, setRoute] = useState<AppRoute>(readBrowserRoute);

  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  useEffect(() => installBrowserNavigation(setRoute), []);

  function handleAuthenticated(session: AuthSession): void {
    setAuthSession(session);

    window.history.pushState(null, "", "/");

    setRoute({
      name: "catalog",
    });
  }

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

            <nav aria-label="Konto użytkownika">
              {authSession ? (
                <span
                  className="site-header__account"
                  aria-label={`Zalogowano jako ${authSession.user.email}`}
                >
                  {authSession.user.email}
                </span>
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
          onAuthenticated={handleAuthenticated}
        />
      </main>

      <footer className="site-footer">
        <div className="shell">Ebookstore — wersja developerska</div>
      </footer>
    </>
  );
}

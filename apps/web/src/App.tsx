import { useEffect, useState } from "react";

import { catalogApi } from "./api/catalog-api";
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
}: {
  readonly route: AppRoute;
  readonly catalog: AppCatalogApi;
}) {
  if (route.name === "book-details") {
    return <BookDetails slug={route.slug} catalog={catalog} />;
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

export default function App({ catalog = catalogApi }: AppProps) {
  const [route, setRoute] = useState<AppRoute>(readBrowserRoute);

  useEffect(() => installBrowserNavigation(setRoute), []);

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

          <span className="stage-badge">Publiczny katalog</span>
        </div>
      </header>

      <main id="main-content">
        <MainContent route={route} catalog={catalog} />
      </main>

      <footer className="site-footer">
        <div className="shell">Ebookstore — wersja developerska</div>
      </footer>
    </>
  );
}

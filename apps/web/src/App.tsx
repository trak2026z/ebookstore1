import { catalogApi } from "./api/catalog-api";
import { CatalogPage, type CatalogBooksApi } from "./catalog/CatalogPage";

export interface AppProps {
  readonly catalog?: CatalogBooksApi;
}

export default function App({ catalog = catalogApi }: AppProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Przejdź do treści
      </a>
      <header className="site-header">
        <div className="shell site-header__content">
          <a className="brand" href="/" aria-label="Ebookstore — strona główna">
            Ebookstore
          </a>
          <span className="stage-badge">Sprint 13.2.2</span>
        </div>
      </header>
      <main id="main-content">
        <section className="hero shell" aria-labelledby="page-title">
          <p className="eyebrow">Publiczny katalog e-booków</p>
          <h1 id="page-title">Ebookstore</h1>
          <p className="hero__summary">
            Przeglądaj dostępne książki i przechodź między stronami katalogu.
          </p>
        </section>

        <CatalogPage catalog={catalog} />
      </main>
      <footer className="site-footer">
        <div className="shell">Ebookstore — wersja developerska</div>
      </footer>
    </>
  );
}

const foundationItems = [
  "Strict TypeScript",
  "Testowalny interfejs",
  "Gotowość na klienta API",
] as const;

export default function App() {
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
          <span className="stage-badge">Sprint 13.1.1</span>
        </div>
      </header>
      <main id="main-content">
        <section className="hero shell" aria-labelledby="page-title">
          <p className="eyebrow">Publiczny katalog e-booków</p>
          <h1 id="page-title">Ebookstore</h1>
          <p className="hero__summary">
            Fundament aplikacji webowej jest gotowy. Integracja z API powstanie w następnym
            przyroście.
          </p>
          <ul className="foundation-list" aria-label="Zakres fundamentu">
            {foundationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="site-footer">
        <div className="shell">Ebookstore — wersja deweloperska</div>
      </footer>
    </>
  );
}

import type { PublicBookDetailsResponse } from "@ebookstore/contracts";
import { useEffect, useId, useState } from "react";

import { ApiClientError } from "../api/api-client";
import { BookCover } from "./BookCover";
import { formatPrice } from "./format-price";

const DEFAULT_ERROR_MESSAGE = "Nie udało się pobrać książki. Spróbuj ponownie.";

export interface BookDetailsApi {
  getBook(slug: string): Promise<PublicBookDetailsResponse>;
}

export interface BookDetailsProps {
  readonly slug: string;
  readonly catalog: BookDetailsApi;
}

type BookDetailsState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly book: PublicBookDetailsResponse;
    }
  | { readonly status: "not-found" }
  | {
      readonly status: "error";
      readonly message: string;
    };

function joinNames(names: readonly string[], emptyLabel: string): string {
  return names.length > 0 ? names.join(", ") : emptyLabel;
}

function createErrorState(error: unknown): BookDetailsState {
  if (error instanceof ApiClientError && error.status === 404) {
    return { status: "not-found" };
  }

  return {
    status: "error",
    message: error instanceof ApiClientError ? error.message : DEFAULT_ERROR_MESSAGE,
  };
}

function BackToCatalogLink() {
  return (
    <a className="book-details__back" href="/" data-app-link="true">
      ← Wróć do katalogu
    </a>
  );
}

export function BookDetails({ slug, catalog }: BookDetailsProps) {
  const titleId = useId();
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<BookDetailsState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void catalog.getBook(slug).then(
      (book) => {
        if (active) {
          setState({
            status: "success",
            book,
          });
        }
      },
      (error: unknown) => {
        if (active) {
          setState(createErrorState(error));
        }
      },
    );

    return () => {
      active = false;
    };
  }, [catalog, retryKey, slug]);

  return (
    <section className="book-details shell">
      <BackToCatalogLink />

      {state.status === "loading" && (
        <p className="book-details__message" role="status">
          Ładowanie szczegółów książki…
        </p>
      )}

      {state.status === "not-found" && (
        <div className="book-details__message" role="alert">
          <h1>Nie znaleziono książki</h1>
          <p>Książka mogła zostać usunięta albo adres jest nieprawidłowy.</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="book-details__message" role="alert">
          <h1>Nie udało się pobrać książki</h1>
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setRetryKey((current) => current + 1);
            }}
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {state.status === "success" && (
        <article className="book-details__card" aria-labelledby={titleId}>
          <BookCover title={state.book.title} coverUrl={state.book.coverUrl} variant="details" />

          <div className="book-details__content">
            <div className="book-details__heading">
              <div>
                <p className="eyebrow">Szczegóły e-booka</p>
                <h1 id={titleId}>{state.book.title}</h1>
              </div>

              <span className="book-card__format">{state.book.format}</span>
            </div>

            <p className="book-details__description">{state.book.description}</p>

            <dl className="book-details__metadata">
              <div>
                <dt>Autorzy</dt>
                <dd>
                  {joinNames(
                    state.book.authors.map((author) => author.displayName),
                    "Autor nieznany",
                  )}
                </dd>
              </div>

              <div>
                <dt>Kategorie</dt>
                <dd>
                  {joinNames(
                    state.book.categories.map((category) => category.name),
                    "Bez kategorii",
                  )}
                </dd>
              </div>

              <div>
                <dt>ISBN</dt>
                <dd>{state.book.isbn}</dd>
              </div>

              <div>
                <dt>Format</dt>
                <dd>{state.book.format}</dd>
              </div>
            </dl>

            <p
              className="book-details__price"
              aria-label={`Cena: ${formatPrice(state.book.price)}`}
            >
              {formatPrice(state.book.price)}
            </p>
          </div>
        </article>
      )}
    </section>
  );
}

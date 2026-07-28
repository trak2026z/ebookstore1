import type { PublicBookListResponse } from "@ebookstore/contracts";
import { useEffect, useState } from "react";

import { ApiClientError } from "../api/api-client";
import { catalogApi, type PublicBookListQuery } from "../api/catalog-api";
import { BookList } from "./BookList";

const PAGE_SIZE = 12;
const DEFAULT_ERROR_MESSAGE = "Nie udało się pobrać katalogu. Spróbuj ponownie.";

export interface CatalogBooksApi {
  getBooks(query: PublicBookListQuery): Promise<PublicBookListResponse>;
}

export interface CatalogPageProps {
  readonly catalog?: CatalogBooksApi;
}

type CatalogState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly response: PublicBookListResponse;
    }
  | {
      readonly status: "error";
      readonly message: string;
    };

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : DEFAULT_ERROR_MESSAGE;
}

interface PaginationProps {
  readonly response: PublicBookListResponse;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

function Pagination({ response, onPrevious, onNext }: PaginationProps) {
  const { page, totalPages } = response.pagination;
  const displayedTotalPages = Math.max(totalPages, 1);
  const previousDisabled = page <= 1;
  const nextDisabled = totalPages === 0 || page >= totalPages;

  return (
    <nav className="pagination" aria-label="Paginacja katalogu">
      <button type="button" onClick={onPrevious} disabled={previousDisabled}>
        Poprzednia
      </button>
      <span className="pagination__summary" aria-live="polite">
        Strona {page} z {displayedTotalPages}
      </span>
      <button type="button" onClick={onNext} disabled={nextDisabled}>
        Następna
      </button>
    </nav>
  );
}

export function CatalogPage({ catalog = catalogApi }: CatalogPageProps) {
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState<CatalogState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void catalog.getBooks({ page, pageSize: PAGE_SIZE }).then(
      (response) => {
        if (active) {
          setState({ status: "success", response });
        }
      },
      (error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: getErrorMessage(error),
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [catalog, page, retryKey]);

  return (
    <section className="catalog-section shell" aria-labelledby="catalog-title">
      <div className="catalog-section__header">
        <div>
          <p className="eyebrow">Katalog</p>
          <h2 id="catalog-title">Dostępne e-booki</h2>
        </div>
        <p>Na stronie wyświetlamy maksymalnie {PAGE_SIZE} pozycji.</p>
      </div>

      {state.status === "loading" && (
        <p className="catalog-status" role="status">
          Ładowanie katalogu…
        </p>
      )}

      {state.status === "error" && (
        <div className="catalog-error" role="alert">
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
        <>
          <BookList books={state.response.items} />
          <Pagination
            response={state.response}
            onPrevious={() => {
              setPage(state.response.pagination.page - 1);
            }}
            onNext={() => {
              setPage(state.response.pagination.page + 1);
            }}
          />
        </>
      )}
    </section>
  );
}

import type {
  AuthorListItem,
  AuthorListResponse,
  CategoryListItem,
  CategoryListResponse,
  PublicBookListResponse,
} from "@ebookstore/contracts";
import { useEffect, useState } from "react";

import { ApiClientError } from "../api/api-client";
import { catalogApi, type PublicBookListQuery } from "../api/catalog-api";
import { BookList } from "./BookList";
import { CatalogFilters, EMPTY_CATALOG_FILTERS, type CatalogFilterValues } from "./CatalogFilters";

const PAGE_SIZE = 12;
const DEFAULT_ERROR_MESSAGE = "Nie udało się pobrać katalogu. Spróbuj ponownie.";
const FILTER_OPTIONS_WARNING = "Nie udało się pobrać części filtrów. Lista książek nadal działa.";

export interface CatalogBooksApi {
  getBooks(query: PublicBookListQuery): Promise<PublicBookListResponse>;
  getAuthors?(): Promise<AuthorListResponse>;
  getCategories?(): Promise<CategoryListResponse>;
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

interface FilterOptionsState {
  readonly authors: readonly AuthorListItem[];
  readonly categories: readonly CategoryListItem[];
  readonly loading: boolean;
  readonly warning: string | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiClientError ? error.message : DEFAULT_ERROR_MESSAGE;
}

function normalizeFilters(filters: CatalogFilterValues): CatalogFilterValues {
  return {
    ...filters,
    query: filters.query.trim(),
    category: filters.category.trim(),
    author: filters.author.trim(),
  };
}

function createBookQuery(page: number, filters: CatalogFilterValues): PublicBookListQuery {
  return {
    page,
    pageSize: PAGE_SIZE,
    ...(filters.query ? { query: filters.query } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.author ? { author: filters.author } : {}),
    ...(filters.sortBy
      ? {
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        }
      : {}),
  };
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
  const [draftFilters, setDraftFilters] = useState<CatalogFilterValues>({
    ...EMPTY_CATALOG_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<CatalogFilterValues>({
    ...EMPTY_CATALOG_FILTERS,
  });
  const [state, setState] = useState<CatalogState>({
    status: "loading",
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptionsState>({
    authors: [],
    categories: [],
    loading: true,
    warning: null,
  });

  useEffect(() => {
    let active = true;

    const authorsRequest =
      catalog.getAuthors?.() ??
      Promise.resolve<AuthorListResponse>({
        items: [],
      });
    const categoriesRequest =
      catalog.getCategories?.() ??
      Promise.resolve<CategoryListResponse>({
        items: [],
      });

    void Promise.allSettled([authorsRequest, categoriesRequest]).then(
      ([authorsResult, categoriesResult]) => {
        if (!active) {
          return;
        }

        const warning =
          authorsResult.status === "rejected" || categoriesResult.status === "rejected"
            ? FILTER_OPTIONS_WARNING
            : null;

        setFilterOptions({
          authors: authorsResult.status === "fulfilled" ? authorsResult.value.items : [],
          categories: categoriesResult.status === "fulfilled" ? categoriesResult.value.items : [],
          loading: false,
          warning,
        });
      },
    );

    return () => {
      active = false;
    };
  }, [catalog]);

  useEffect(() => {
    let active = true;

    setState({ status: "loading" });

    void catalog.getBooks(createBookQuery(page, appliedFilters)).then(
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
  }, [appliedFilters, catalog, page, retryKey]);

  function applyFilters(): void {
    const normalizedFilters = normalizeFilters(draftFilters);

    setDraftFilters(normalizedFilters);
    setPage(1);
    setAppliedFilters(normalizedFilters);
  }

  function clearFilters(): void {
    const emptyFilters = {
      ...EMPTY_CATALOG_FILTERS,
    };

    setDraftFilters(emptyFilters);
    setPage(1);
    setAppliedFilters(emptyFilters);
  }

  return (
    <section className="catalog-section shell" aria-labelledby="catalog-title">
      <div className="catalog-section__header">
        <div>
          <p className="eyebrow">Katalog</p>
          <h2 id="catalog-title">Dostępne e-booki</h2>
        </div>
        <p>Na stronie wyświetlamy maksymalnie {PAGE_SIZE} pozycji.</p>
      </div>

      <CatalogFilters
        values={draftFilters}
        authors={filterOptions.authors}
        categories={filterOptions.categories}
        optionsLoading={filterOptions.loading}
        optionsWarning={filterOptions.warning}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onClear={clearFilters}
      />

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

import type { AuthorListItem, CategoryListItem } from "@ebookstore/contracts";
import type { ChangeEvent, FormEvent } from "react";

import type { PublicBookSortBy, PublicBookSortOrder } from "../api/catalog-api";

export interface CatalogFilterValues {
  readonly query: string;
  readonly category: string;
  readonly author: string;
  readonly sortBy: PublicBookSortBy | "";
  readonly sortOrder: PublicBookSortOrder;
}

export const EMPTY_CATALOG_FILTERS: CatalogFilterValues = {
  query: "",
  category: "",
  author: "",
  sortBy: "",
  sortOrder: "desc",
};

export interface CatalogFiltersProps {
  readonly values: CatalogFilterValues;
  readonly authors: readonly AuthorListItem[];
  readonly categories: readonly CategoryListItem[];
  readonly optionsLoading: boolean;
  readonly optionsWarning: string | null;
  readonly onChange: (values: CatalogFilterValues) => void;
  readonly onApply: () => void;
  readonly onClear: () => void;
}

export function CatalogFilters({
  values,
  authors,
  categories,
  optionsLoading,
  optionsWarning,
  onChange,
  onApply,
  onClear,
}: CatalogFiltersProps) {
  function updateValues(patch: Partial<CatalogFilterValues>): void {
    onChange({
      ...values,
      ...patch,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onApply();
  }

  return (
    <form className="catalog-filters" aria-label="Filtry katalogu" onSubmit={handleSubmit}>
      <div className="catalog-filters__grid">
        <label>
          <span>Szukaj</span>
          <input
            type="search"
            name="query"
            value={values.query}
            placeholder="Tytuł książki"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateValues({ query: event.currentTarget.value });
            }}
          />
        </label>

        <label>
          <span>Kategoria</span>
          <select
            name="category"
            value={values.category}
            disabled={optionsLoading}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                category: event.currentTarget.value,
              });
            }}
          >
            <option value="">Wszystkie kategorie</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Autor</span>
          <select
            name="author"
            value={values.author}
            disabled={optionsLoading}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                author: event.currentTarget.value,
              });
            }}
          >
            <option value="">Wszyscy autorzy</option>
            {authors.map((author) => (
              <option key={author.slug} value={author.slug}>
                {author.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sortuj według</span>
          <select
            name="sortBy"
            value={values.sortBy}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                sortBy: event.currentTarget.value as CatalogFilterValues["sortBy"],
              });
            }}
          >
            <option value="">Domyślnie</option>
            <option value="createdAt">Data dodania</option>
            <option value="title">Tytuł</option>
            <option value="price">Cena</option>
          </select>
        </label>

        <label>
          <span>Kierunek</span>
          <select
            name="sortOrder"
            value={values.sortOrder}
            disabled={!values.sortBy}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              updateValues({
                sortOrder: event.currentTarget.value as PublicBookSortOrder,
              });
            }}
          >
            <option value="asc">Rosnąco</option>
            <option value="desc">Malejąco</option>
          </select>
        </label>
      </div>

      <div className="catalog-filters__actions">
        <button type="submit">Zastosuj</button>
        <button type="button" onClick={onClear}>
          Wyczyść
        </button>
      </div>

      {optionsLoading && (
        <p className="catalog-filters__note" role="status">
          Ładowanie autorów i kategorii…
        </p>
      )}

      {optionsWarning && (
        <p className="catalog-filters__warning" role="status">
          {optionsWarning}
        </p>
      )}
    </form>
  );
}

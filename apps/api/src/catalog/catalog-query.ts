export const DEFAULT_CATALOG_PAGE = 1;
export const DEFAULT_CATALOG_PAGE_SIZE = 20;
export const MAX_CATALOG_PAGE_SIZE = 100;

export const CATALOG_SORT_VALUES = ["newest", "title-asc", "price-asc", "price-desc"] as const;

export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

export interface RawCatalogQuery {
  readonly page?: string;
  readonly pageSize?: string;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort?: string;
}

export interface CatalogQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort: CatalogSort;
}

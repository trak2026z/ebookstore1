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

export function parseCatalogQuery(input: RawCatalogQuery): CatalogQuery {
  const page = parsePositiveInteger(input.page, "page", DEFAULT_CATALOG_PAGE);
  const pageSize = parsePositiveInteger(
    input.pageSize,
    "pageSize",
    DEFAULT_CATALOG_PAGE_SIZE,
    MAX_CATALOG_PAGE_SIZE,
  );
  const sort = parseCatalogSort(input.sort);

  const category = normalizeOptionalText(input.category);
  const author = normalizeOptionalText(input.author);
  const q = normalizeOptionalText(input.q);

  return {
    page,
    pageSize,
    sort,
    ...(category === undefined ? {} : { category }),
    ...(author === undefined ? {} : { author }),
    ...(q === undefined ? {} : { q }),
  };
}

function parsePositiveInteger(
  value: string | undefined,
  fieldName: string,
  defaultValue: number,
  maximum?: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.trim();

  if (!/^[1-9]\d*$/.test(normalizedValue)) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`${fieldName} must be a safe integer`);
  }

  if (maximum !== undefined && parsedValue > maximum) {
    throw new Error(`${fieldName} must not exceed ${maximum}`);
  }

  return parsedValue;
}

function parseCatalogSort(value: string | undefined): CatalogSort {
  if (value === undefined) {
    return "newest";
  }

  const normalizedValue = value.trim();

  if (!isCatalogSort(normalizedValue)) {
    throw new Error(`sort must be one of: ${CATALOG_SORT_VALUES.join(", ")}`);
  }

  return normalizedValue;
}

function isCatalogSort(value: string): value is CatalogSort {
  return CATALOG_SORT_VALUES.some((sort) => sort === value);
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? undefined : normalizedValue;
}

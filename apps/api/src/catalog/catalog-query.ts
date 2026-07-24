export const DEFAULT_CATALOG_PAGE = 1;
export const DEFAULT_CATALOG_PAGE_SIZE = 20;
export const MAX_CATALOG_PAGE_SIZE = 100;

export const CATALOG_SORT_BY_VALUES = ["createdAt", "title", "price"] as const;
export const CATALOG_SORT_ORDER_VALUES = ["asc", "desc"] as const;
export const CATALOG_SORT_VALUES = [
  "newest",
  "oldest",
  "title-asc",
  "title-desc",
  "price-asc",
  "price-desc",
] as const;

export type CatalogSortBy = (typeof CATALOG_SORT_BY_VALUES)[number];
export type CatalogSortOrder = (typeof CATALOG_SORT_ORDER_VALUES)[number];
export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

export type RawCatalogQuery = Readonly<Record<string, unknown>>;

export interface CatalogQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort: CatalogSort;
}

const CATALOG_QUERY_PARAMETERS = [
  "page",
  "pageSize",
  "query",
  "category",
  "author",
  "sortBy",
  "sortOrder",
] as const;

const CATALOG_QUERY_PARAMETER_SET: ReadonlySet<string> = new Set(CATALOG_QUERY_PARAMETERS);

export function parseCatalogQuery(input: RawCatalogQuery): CatalogQuery {
  validateQueryParameterNames(input);

  const page = parsePositiveInteger(
    readOptionalString(input, "page"),
    "page",
    DEFAULT_CATALOG_PAGE,
  );
  const pageSize = parsePositiveInteger(
    readOptionalString(input, "pageSize"),
    "pageSize",
    DEFAULT_CATALOG_PAGE_SIZE,
    MAX_CATALOG_PAGE_SIZE,
  );
  const sortBy = parseCatalogSortBy(readOptionalString(input, "sortBy"));
  const sortOrder = parseCatalogSortOrder(readOptionalString(input, "sortOrder"));

  const category = normalizeOptionalText(readOptionalString(input, "category"));
  const author = normalizeOptionalText(readOptionalString(input, "author"));
  const q = normalizeOptionalText(readOptionalString(input, "query"));

  return {
    page,
    pageSize,
    sort: mapCatalogSort(sortBy, sortOrder),
    ...(category === undefined ? {} : { category }),
    ...(author === undefined ? {} : { author }),
    ...(q === undefined ? {} : { q }),
  };
}

function validateQueryParameterNames(input: RawCatalogQuery): void {
  for (const parameterName of Object.keys(input)) {
    if (!CATALOG_QUERY_PARAMETER_SET.has(parameterName)) {
      throw new Error(`Unsupported catalog query parameter: ${parameterName}`);
    }
  }
}

function readOptionalString(input: RawCatalogQuery, fieldName: string): string | undefined {
  const value = input[fieldName];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a single string`);
  }

  return value;
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

function parseCatalogSortBy(value: string | undefined): CatalogSortBy {
  if (value === undefined) {
    return "createdAt";
  }

  const normalizedValue = value.trim();

  if (!isCatalogSortBy(normalizedValue)) {
    throw new Error(`sortBy must be one of: ${CATALOG_SORT_BY_VALUES.join(", ")}`);
  }

  return normalizedValue;
}

function parseCatalogSortOrder(value: string | undefined): CatalogSortOrder {
  if (value === undefined) {
    return "desc";
  }

  const normalizedValue = value.trim();

  if (!isCatalogSortOrder(normalizedValue)) {
    throw new Error(`sortOrder must be one of: ${CATALOG_SORT_ORDER_VALUES.join(", ")}`);
  }

  return normalizedValue;
}

function mapCatalogSort(sortBy: CatalogSortBy, sortOrder: CatalogSortOrder): CatalogSort {
  switch (sortBy) {
    case "createdAt":
      return sortOrder === "asc" ? "oldest" : "newest";
    case "title":
      return sortOrder === "asc" ? "title-asc" : "title-desc";
    case "price":
      return sortOrder === "asc" ? "price-asc" : "price-desc";
  }
}

function isCatalogSortBy(value: string): value is CatalogSortBy {
  return CATALOG_SORT_BY_VALUES.some((sortBy) => sortBy === value);
}

function isCatalogSortOrder(value: string): value is CatalogSortOrder {
  return CATALOG_SORT_ORDER_VALUES.some((sortOrder) => sortOrder === value);
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? undefined : normalizedValue;
}

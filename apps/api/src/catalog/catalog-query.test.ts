import { describe, expect, it } from "vitest";

import {
  CATALOG_SORT_BY_VALUES,
  CATALOG_SORT_ORDER_VALUES,
  DEFAULT_CATALOG_PAGE,
  DEFAULT_CATALOG_PAGE_SIZE,
  parseCatalogQuery,
} from "./catalog-query";

describe("parseCatalogQuery", () => {
  it("returns default pagination and sorting values", () => {
    expect(parseCatalogQuery({})).toEqual({
      page: DEFAULT_CATALOG_PAGE,
      pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      sort: "newest",
    });
  });

  it("parses valid pagination and sorting values", () => {
    expect(
      parseCatalogQuery({
        page: "2",
        pageSize: "40",
        sortBy: "price",
        sortOrder: "desc",
      }),
    ).toEqual({
      page: 2,
      pageSize: 40,
      sort: "price-desc",
    });
  });

  it("trims pagination, sorting, and filter values", () => {
    expect(
      parseCatalogQuery({
        page: " 3 ",
        pageSize: " 25 ",
        category: " fiction ",
        author: " ursula-le-guin ",
        query: " left hand ",
        sortBy: " title ",
        sortOrder: " asc ",
      }),
    ).toEqual({
      page: 3,
      pageSize: 25,
      category: "fiction",
      author: "ursula-le-guin",
      q: "left hand",
      sort: "title-asc",
    });
  });

  it("omits empty optional filters", () => {
    const result = parseCatalogQuery({
      category: "",
      author: "   ",
      query: "\t",
    });

    expect(result).toEqual({
      page: DEFAULT_CATALOG_PAGE,
      pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      sort: "newest",
    });
    expect(result).not.toHaveProperty("category");
    expect(result).not.toHaveProperty("author");
    expect(result).not.toHaveProperty("q");
  });

  it.each(["0", "-1", "1.5", "abc", "+1", "1e2", ""])("rejects invalid page value %j", (page) => {
    expect(() => parseCatalogQuery({ page })).toThrow("page must be a positive integer");
  });

  it.each(["0", "-1", "1.5", "abc", "+1", "1e2", ""])(
    "rejects invalid pageSize value %j",
    (pageSize) => {
      expect(() => parseCatalogQuery({ pageSize })).toThrow("pageSize must be a positive integer");
    },
  );

  it("rejects pageSize above the configured limit", () => {
    expect(() => parseCatalogQuery({ pageSize: "101" })).toThrow("pageSize must not exceed 100");
  });

  it("rejects integers outside the safe JavaScript range", () => {
    expect(() => parseCatalogQuery({ page: "9007199254740992" })).toThrow(
      "page must be a safe integer",
    );
  });

  it.each([
    ["createdAt", "asc", "oldest"],
    ["createdAt", "desc", "newest"],
    ["title", "asc", "title-asc"],
    ["title", "desc", "title-desc"],
    ["price", "asc", "price-asc"],
    ["price", "desc", "price-desc"],
  ] as const)("maps sortBy=%s and sortOrder=%s to %s", (sortBy, sortOrder, expectedSort) => {
    expect(parseCatalogQuery({ sortBy, sortOrder }).sort).toBe(expectedSort);
  });

  it.each(CATALOG_SORT_BY_VALUES)("accepts sortBy=%s", (sortBy) => {
    expect(() => parseCatalogQuery({ sortBy })).not.toThrow();
  });

  it.each(CATALOG_SORT_ORDER_VALUES)("accepts sortOrder=%s", (sortOrder) => {
    expect(() => parseCatalogQuery({ sortOrder })).not.toThrow();
  });

  it.each(["unknown", "", "TITLE", "date"])("rejects invalid sortBy value %j", (sortBy) => {
    expect(() => parseCatalogQuery({ sortBy })).toThrow(
      "sortBy must be one of: createdAt, title, price",
    );
  });

  it.each(["unknown", "", "ASC", "ascending"])(
    "rejects invalid sortOrder value %j",
    (sortOrder) => {
      expect(() => parseCatalogQuery({ sortOrder })).toThrow("sortOrder must be one of: asc, desc");
    },
  );

  it.each(["q", "sort", "unknown"])("rejects unsupported parameter %j", (parameterName) => {
    expect(() => parseCatalogQuery({ [parameterName]: "value" })).toThrow(
      `Unsupported catalog query parameter: ${parameterName}`,
    );
  });

  it.each([
    ["page", ["1", "2"]],
    ["query", ["typescript", "nestjs"]],
    ["sortBy", { value: "title" }],
    ["sortOrder", 1],
  ] as const)("rejects non-string value for %s", (fieldName, value) => {
    expect(() => parseCatalogQuery({ [fieldName]: value })).toThrow(
      `${fieldName} must be a single string`,
    );
  });
});

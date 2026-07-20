import { describe, expect, it } from "vitest";

import {
  CATALOG_SORT_VALUES,
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
        sort: "price-desc",
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
        q: " left hand ",
        sort: " title-asc ",
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
      q: "\t",
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

  it.each(CATALOG_SORT_VALUES)("accepts the %s sorting value", (sort) => {
    expect(parseCatalogQuery({ sort }).sort).toBe(sort);
  });

  it.each(["unknown", "", "TITLE-ASC", "price"])("rejects invalid sorting value %j", (sort) => {
    expect(() => parseCatalogQuery({ sort })).toThrow(
      "sort must be one of: newest, title-asc, title-desc, price-asc, price-desc",
    );
  });
});

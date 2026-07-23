import { describe, expect, it } from "vitest";

import { CATALOG_SEED, isValidIsbn13 } from "./catalog-seed";

describe("CATALOG_SEED", () => {
  it("contains unique and valid ISBN-13 values", () => {
    const isbnValues = CATALOG_SEED.books.map((book) => book.isbn);

    expect(new Set(isbnValues).size).toBe(isbnValues.length);

    for (const isbn of isbnValues) {
      expect(isValidIsbn13(isbn)).toBe(true);
    }
  });

  it("contains unique entity slugs", () => {
    expectUnique(CATALOG_SEED.authors.map((author) => author.slug));
    expectUnique(CATALOG_SEED.categories.map((category) => category.slug));
    expectUnique(CATALOG_SEED.books.map((book) => book.slug));
  });

  it("covers every catalog lifecycle status", () => {
    expect(new Set(CATALOG_SEED.books.map((book) => book.status))).toEqual(
      new Set(["DRAFT", "PUBLISHED", "WITHDRAWN"]),
    );
  });

  it("contains books with multiple authors and categories", () => {
    expect(CATALOG_SEED.books.some((book) => book.authors.length > 1)).toBe(true);
    expect(CATALOG_SEED.books.some((book) => book.categories.length > 1)).toBe(true);
  });

  it("references only declared authors and categories", () => {
    const authorSlugs = new Set(CATALOG_SEED.authors.map((author) => author.slug));
    const categorySlugs = new Set(CATALOG_SEED.categories.map((category) => category.slug));

    for (const book of CATALOG_SEED.books) {
      for (const author of book.authors) {
        expect(authorSlugs.has(author.slug)).toBe(true);
      }

      for (const category of book.categories) {
        expect(categorySlugs.has(category.slug)).toBe(true);
      }
    }
  });
});

describe("isValidIsbn13", () => {
  it.each([
    ["9780000000002", true],
    ["9780000000003", false],
    ["97800000000A2", false],
    ["978000000002", false],
  ])("validates %s as %s", (isbn, expected) => {
    expect(isValidIsbn13(isbn)).toBe(expected);
  });
});

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

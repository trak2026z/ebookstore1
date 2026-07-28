// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { PublicBookListItem } from "@ebookstore/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BookList } from "./BookList";
import { formatPrice } from "./format-price";

afterEach(cleanup);

const book = {
  id: "book-1",
  slug: "typescript-bez-tajemnic",
  title: "TypeScript bez tajemnic",
  authors: [
    { id: "author-1", displayName: "Ada Lovelace", slug: "ada-lovelace" },
    { id: "author-2", displayName: "Grace Hopper", slug: "grace-hopper" },
  ],
  categories: [
    { id: "category-1", name: "Programowanie", slug: "programowanie" },
    {
      id: "category-2",
      name: "Historia technologii",
      slug: "historia-technologii",
    },
  ],
  price: { amountMinor: 4_999, currency: "PLN" },
  format: "EPUB",
  coverUrl: "/api/v1/books/book-1/cover",
} satisfies PublicBookListItem;

describe("BookList", () => {
  it("renders contract data as a semantic book list", () => {
    render(<BookList books={[book]} />);

    expect(screen.getByRole("list", { name: "Książki" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    const card = screen.getByRole("article", { name: book.title });

    expect(within(card).getByText("Ada Lovelace, Grace Hopper")).toBeInTheDocument();
    expect(within(card).getByText("Programowanie, Historia technologii")).toBeInTheDocument();
    expect(within(card).getByText("EPUB")).toBeInTheDocument();
    expect(
      within(card).getByRole("img", {
        name: `Okładka książki ${book.title}`,
      }),
    ).toHaveAttribute("loading", "lazy");
    expect(within(card).getByLabelText(/^Cena: 49,99\s*zł$/)).toBeInTheDocument();
  });

  it("renders a clear empty state instead of an empty list", () => {
    render(<BookList books={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Brak książek do wyświetlenia.");
    expect(screen.queryByRole("list", { name: "Książki" })).not.toBeInTheDocument();
  });
});

describe("formatPrice", () => {
  it("uses minor units and rejects invalid amounts", () => {
    expect(
      formatPrice({
        amountMinor: 1_234_567,
        currency: "PLN",
      }).replace(/\s/g, " "),
    ).toBe("12 345,67 zł");
    expect(() => formatPrice({ amountMinor: -1, currency: "PLN" })).toThrow(RangeError);
    expect(() => formatPrice({ amountMinor: 1.5, currency: "PLN" })).toThrow(RangeError);
  });
});

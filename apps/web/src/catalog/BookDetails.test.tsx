// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  PublicBookDetailsResponse,
} from "@ebookstore/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { ApiClientError } from "../api/api-client";
import {
  BookDetails,
  type BookDetailsApi,
} from "./BookDetails";

afterEach(cleanup);

const book: PublicBookDetailsResponse = {
  id: "book-1",
  slug: "typescript-bez-tajemnic",
  title: "TypeScript bez tajemnic",
  authors: [
    {
      id: "author-1",
      displayName: "Ada Lovelace",
      slug: "ada-lovelace",
    },
  ],
  categories: [
    {
      id: "category-1",
      name: "Programowanie",
      slug: "programowanie",
    },
  ],
  price: {
    amountMinor: 4_999,
    currency: "PLN",
  },
  format: "EPUB",
  coverUrl: "/api/v1/books/book-1/cover",
  isbn: "978-83-00000-00-1",
  description:
    "Praktyczny przewodnik po bezpiecznym TypeScript.",
};

describe("BookDetails", () => {
  it("loads and renders the complete public contract", async () => {
    const requestedSlugs: string[] = [];
    const catalog: BookDetailsApi = {
      async getBook(slug) {
        requestedSlugs.push(slug);

        return book;
      },
    };

    render(
      <BookDetails
        slug={book.slug}
        catalog={catalog}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ładowanie szczegółów książki…",
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: book.title,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(book.description),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ada Lovelace"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Programowanie"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(book.isbn),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: `Okładka książki ${book.title}`,
      }),
    ).toHaveAttribute("loading", "eager");
    expect(
      screen.getByLabelText(/^Cena: 49,99\s*zł$/),
    ).toBeInTheDocument();
    expect(requestedSlugs).toEqual([book.slug]);
  });

  it("renders a dedicated not-found state for HTTP 404", async () => {
    const catalog: BookDetailsApi = {
      async getBook() {
        throw new ApiClientError({
          status: 404,
          code: "BOOK_NOT_FOUND",
          message: "Book not found.",
          requestId: "request-404",
          details: [],
        });
      },
    };

    render(
      <BookDetails
        slug="brak-ksiazki"
        catalog={catalog}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Nie znaleziono książki",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Spróbuj ponownie",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows an API error and retries the same slug", async () => {
    const requestedSlugs: string[] = [];
    const catalog: BookDetailsApi = {
      async getBook(slug) {
        requestedSlugs.push(slug);

        if (requestedSlugs.length === 1) {
          throw new ApiClientError({
            status: 503,
            code: "SERVICE_UNAVAILABLE",
            message:
              "Książka jest chwilowo niedostępna.",
            requestId: "request-503",
            details: [],
          });
        }

        return book;
      },
    };

    render(
      <BookDetails
        slug={book.slug}
        catalog={catalog}
      />,
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Książka jest chwilowo niedostępna.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Spróbuj ponownie",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: book.title,
      }),
    ).toBeInTheDocument();

    expect(requestedSlugs).toEqual([
      book.slug,
      book.slug,
    ]);
  });
});

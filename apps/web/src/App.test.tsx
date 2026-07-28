// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
  PublicBookDetailsResponse,
  PublicBookListItem,
  PublicBookListResponse,
} from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App, { type AppCatalogApi } from "./App";

const bookListItem: PublicBookListItem = {
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
  coverUrl: null,
};

const bookDetails: PublicBookDetailsResponse = {
  ...bookListItem,
  isbn: "978-83-00000-00-1",
  description: "Praktyczny przewodnik po TypeScript.",
};

function createListResponse(items: readonly PublicBookListItem[]): PublicBookListResponse {
  return {
    items,
    pagination: {
      page: 1,
      pageSize: 12,
      totalItems: items.length,
      totalPages: items.length > 0 ? 1 : 0,
    },
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("App", () => {
  it("renders the public catalog shell and loads its first page", async () => {
    const requestedPages: number[] = [];
    const catalog: AppCatalogApi = {
      async getBooks(query) {
        requestedPages.push(query.page ?? 1);

        return createListResponse([]);
      },
      async getBook() {
        return bookDetails;
      },
    };

    render(<App catalog={catalog} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Publiczny katalog e-booków")).toBeInTheDocument();

    expect(await screen.findByText("Brak książek do wyświetlenia.")).toBeInTheDocument();

    expect(requestedPages).toEqual([1]);
  });

  it("opens a book from the catalog without reloading the application", async () => {
    const requestedSlugs: string[] = [];
    const catalog: AppCatalogApi = {
      async getBooks() {
        return createListResponse([bookListItem]);
      },
      async getBook(slug) {
        requestedSlugs.push(slug);

        return bookDetails;
      },
    };

    render(<App catalog={catalog} />);

    fireEvent.click(
      await screen.findByRole("link", {
        name: bookListItem.title,
      }),
    );

    expect(window.location.pathname).toBe(`/books/${bookListItem.slug}`);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: bookDetails.title,
      }),
    ).toBeInTheDocument();

    expect(requestedSlugs).toEqual([bookListItem.slug]);
  });

  it("renders a direct book URL and returns to the catalog through history", async () => {
    const catalog: AppCatalogApi = {
      async getBooks() {
        return createListResponse([]);
      },
      async getBook() {
        return bookDetails;
      },
    };

    window.history.replaceState(null, "", `/books/${bookDetails.slug}`);

    render(<App catalog={catalog} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: bookDetails.title,
      }),
    ).toBeInTheDocument();

    window.history.pushState(null, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ebookstore",
      }),
    ).toBeInTheDocument();
  });
});

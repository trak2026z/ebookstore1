// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { PublicBookListItem, PublicBookListResponse } from "@ebookstore/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiClientError } from "../api/api-client";
import type { PublicBookListQuery } from "../api/catalog-api";
import { CatalogPage, type CatalogBooksApi } from "./CatalogPage";

afterEach(cleanup);

function createBook(page: number): PublicBookListItem {
  return {
    id: `book-${page}`,
    slug: `ksiazka-${page}`,
    title: `Książka ${page}`,
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
}

function createResponse(page: number, totalPages: number): PublicBookListResponse {
  return {
    items: [createBook(page)],
    pagination: {
      page,
      pageSize: 12,
      totalItems: totalPages,
      totalPages,
    },
  };
}

describe("CatalogPage", () => {
  it("requests the first page and exposes a loading state", () => {
    const requests: PublicBookListQuery[] = [];
    const catalog: CatalogBooksApi = {
      getBooks(query) {
        requests.push(query);

        return new Promise<PublicBookListResponse>(() => undefined);
      },
    };

    render(<CatalogPage catalog={catalog} />);

    expect(screen.getByRole("status")).toHaveTextContent("Ładowanie katalogu…");
    expect(requests).toEqual([{ page: 1, pageSize: 12 }]);
  });

  it("loads next and previous pages and disables boundary controls", async () => {
    const requests: PublicBookListQuery[] = [];
    const catalog: CatalogBooksApi = {
      async getBooks(query) {
        requests.push(query);

        return createResponse(query.page ?? 1, 2);
      },
    };

    render(<CatalogPage catalog={catalog} />);

    expect(await screen.findByRole("heading", { name: "Książka 1" })).toBeInTheDocument();
    expect(screen.getByText("Strona 1 z 2")).toBeInTheDocument();

    const previousButton = screen.getByRole("button", {
      name: "Poprzednia",
    });
    const nextButton = screen.getByRole("button", {
      name: "Następna",
    });

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    expect(await screen.findByRole("heading", { name: "Książka 2" })).toBeInTheDocument();
    expect(screen.getByText("Strona 2 z 2")).toBeInTheDocument();

    const pageTwoPreviousButton = screen.getByRole("button", {
      name: "Poprzednia",
    });
    const pageTwoNextButton = screen.getByRole("button", {
      name: "Następna",
    });

    expect(pageTwoPreviousButton).toBeEnabled();
    expect(pageTwoNextButton).toBeDisabled();

    fireEvent.click(pageTwoPreviousButton);

    expect(await screen.findByRole("heading", { name: "Książka 1" })).toBeInTheDocument();

    await waitFor(() => {
      expect(requests).toEqual([
        { page: 1, pageSize: 12 },
        { page: 2, pageSize: 12 },
        { page: 1, pageSize: 12 },
      ]);
    });
  });

  it("shows an API error and retries the current page", async () => {
    let callCount = 0;
    const catalog: CatalogBooksApi = {
      async getBooks(query) {
        callCount += 1;

        if (callCount === 1) {
          throw new ApiClientError({
            status: 503,
            code: "SERVICE_UNAVAILABLE",
            message: "Katalog jest chwilowo niedostępny.",
            requestId: "request-503",
            details: [],
          });
        }

        return createResponse(query.page ?? 1, 1);
      },
    };

    render(<CatalogPage catalog={catalog} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Katalog jest chwilowo niedostępny.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByRole("heading", { name: "Książka 1" })).toBeInTheDocument();
    expect(callCount).toBe(2);
  });
});

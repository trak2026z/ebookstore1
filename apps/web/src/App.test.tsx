// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { PublicBookListResponse } from "@ebookstore/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";
import type { CatalogBooksApi } from "./catalog/CatalogPage";

afterEach(cleanup);

const emptyResponse: PublicBookListResponse = {
  items: [],
  pagination: {
    page: 1,
    pageSize: 12,
    totalItems: 0,
    totalPages: 0,
  },
};

describe("App", () => {
  it("renders the public catalog shell and loads its first page", async () => {
    const requestedPages: number[] = [];
    const catalog: CatalogBooksApi = {
      async getBooks(query) {
        requestedPages.push(query.page ?? 1);

        return emptyResponse;
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
});

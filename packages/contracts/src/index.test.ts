import { describe, expect, it } from "vitest";

import type { HealthResponse, PublicBookDetailsResponse, PublicBookListResponse } from "./index.js";

describe("HealthResponse", () => {
  it("accepts the supported health status", () => {
    const response: HealthResponse = { status: "ok" };

    expect(response.status).toBe("ok");
  });
});

describe("public catalog contracts", () => {
  it("represents a paginated public book list", () => {
    const response: PublicBookListResponse = {
      items: [
        {
          id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
          slug: "typescript-w-praktyce",
          title: "TypeScript w praktyce",
          authors: [
            {
              id: "15f20d15-5155-41e7-b2bd-93780155ef71",
              displayName: "Jan Kowalski",
              slug: "jan-kowalski",
            },
          ],
          categories: [
            {
              id: "49c70299-c691-46aa-b9c0-beb96780f674",
              name: "Programowanie",
              slug: "programowanie",
            },
          ],
          price: {
            amountMinor: 4999,
            currency: "PLN",
          },
          format: "PDF",
          coverUrl: "/api/v1/books/8ac42a9c-b736-4575-b7a9-b72f1168ad29/cover",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    };

    expect(response.items).toHaveLength(1);
    expect(response.items[0]).toEqual({
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      slug: "typescript-w-praktyce",
      title: "TypeScript w praktyce",
      authors: [
        {
          id: "15f20d15-5155-41e7-b2bd-93780155ef71",
          displayName: "Jan Kowalski",
          slug: "jan-kowalski",
        },
      ],
      categories: [
        {
          id: "49c70299-c691-46aa-b9c0-beb96780f674",
          name: "Programowanie",
          slug: "programowanie",
        },
      ],
      price: {
        amountMinor: 4999,
        currency: "PLN",
      },
      format: "PDF",
      coverUrl: "/api/v1/books/8ac42a9c-b736-4575-b7a9-b72f1168ad29/cover",
    });
    expect(response.items[0]).not.toHaveProperty("coverKey");
    expect(response.pagination.totalItems).toBe(1);
  });

  it("represents public book details without storage fields", () => {
    const response: PublicBookDetailsResponse = {
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      slug: "typescript-w-praktyce",
      title: "TypeScript w praktyce",
      isbn: "978-83-00000-00-1",
      description: "Praktyczny przewodnik po TypeScript.",
      authors: [],
      categories: [],
      price: {
        amountMinor: 4999,
        currency: "PLN",
      },
      format: "EPUB",
      coverUrl: null,
    };

    type HasCoverKey = "coverKey" extends keyof PublicBookDetailsResponse ? true : false;

    const hasCoverKey: HasCoverKey = false;

    expect(response.isbn).toBe("978-83-00000-00-1");
    expect(response.description).toBe("Praktyczny przewodnik po TypeScript.");
    expect(response.coverUrl).toBeNull();
    expect(response).not.toHaveProperty("coverKey");
    expect(hasCoverKey).toBe(false);
  });
});

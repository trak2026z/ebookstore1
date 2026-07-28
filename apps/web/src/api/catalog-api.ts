import type {
  AuthorListResponse,
  CategoryListResponse,
  PublicBookDetailsResponse,
  PublicBookListResponse,
} from "@ebookstore/contracts";

import { createApiClient, type JsonApiClient } from "./api-client";

export type PublicBookSortBy = "createdAt" | "title" | "price";
export type PublicBookSortOrder = "asc" | "desc";

export interface PublicBookListQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly query?: string;
  readonly category?: string;
  readonly author?: string;
  readonly sortBy?: PublicBookSortBy;
  readonly sortOrder?: PublicBookSortOrder;
}

function appendNumber(parameters: URLSearchParams, name: string, value: number | undefined): void {
  if (value !== undefined) {
    parameters.set(name, String(value));
  }
}

function appendText(parameters: URLSearchParams, name: string, value: string | undefined): void {
  const normalizedValue = value?.trim();

  if (normalizedValue) {
    parameters.set(name, normalizedValue);
  }
}

function createBookListPath(query: PublicBookListQuery): string {
  const parameters = new URLSearchParams();

  appendNumber(parameters, "page", query.page);
  appendNumber(parameters, "pageSize", query.pageSize);
  appendText(parameters, "query", query.query);
  appendText(parameters, "category", query.category);
  appendText(parameters, "author", query.author);
  appendText(parameters, "sortBy", query.sortBy);
  appendText(parameters, "sortOrder", query.sortOrder);

  const queryString = parameters.toString();

  return queryString ? `/api/v1/books?${queryString}` : "/api/v1/books";
}

export function createCatalogApi(client: JsonApiClient) {
  return {
    getBooks(query: PublicBookListQuery = {}): Promise<PublicBookListResponse> {
      return client.get<PublicBookListResponse>(createBookListPath(query));
    },

    getBook(slug: string): Promise<PublicBookDetailsResponse> {
      const normalizedSlug = slug.trim();

      if (!normalizedSlug) {
        throw new TypeError("Book slug must not be empty.");
      }

      return client.get<PublicBookDetailsResponse>(
        `/api/v1/books/${encodeURIComponent(normalizedSlug)}`,
      );
    },

    getAuthors(): Promise<AuthorListResponse> {
      return client.get<AuthorListResponse>("/api/v1/authors");
    },

    getCategories(): Promise<CategoryListResponse> {
      return client.get<CategoryListResponse>("/api/v1/categories");
    },
  };
}

export const catalogApi = createCatalogApi(
  createApiClient({
    baseUrl: import.meta.env["VITE_API_BASE_URL"] ?? "",
  }),
);

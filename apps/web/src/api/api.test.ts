import type { PublicBookListResponse } from "@ebookstore/contracts";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError, createApiClient, type JsonApiClient } from "./api-client";
import { createCatalogApi } from "./catalog-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": "request-123",
    },
  });
}

function createReadOnlyClient(getImpl: JsonApiClient["get"]): JsonApiClient {
  return {
    get: getImpl,

    async post<TResponse>(): Promise<TResponse> {
      throw new Error("Unexpected POST request.");
    },
  };
}

describe("createApiClient", () => {
  it("returns parsed JSON from a successful response", async () => {
    const responseBody = {
      items: [],
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(responseBody));
    const client = createApiClient({
      baseUrl: "http://api:3001/",
      fetchImpl,
    });

    await expect(client.get("/api/v1/books")).resolves.toEqual(responseBody);

    expect(fetchImpl).toHaveBeenCalledWith("http://api:3001/api/v1/books", {
      headers: {
        Accept: "application/json",
      },
    });
  });

  it("serializes a POST body once and sends JSON headers", async () => {
    const responseBody = {
      accessToken: "signed.jwt.token",
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(responseBody));
    const toJSON = vi.fn(() => ({
      email: "user@example.com",
      password: "Correct-Horse-42",
    }));
    const body = { toJSON };
    const client = createApiClient({
      baseUrl: "http://api:3001/",
      fetchImpl,
    });

    await expect(client.post("/api/v1/auth/login", body)).resolves.toEqual(responseBody);

    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("http://api:3001/api/v1/auth/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: '{"email":"user@example.com","password":"Correct-Horse-42"}',
    });
  });

  it("adds a normalized Bearer token to a GET request", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: "user-id",
      }),
    );
    const client = createApiClient({
      fetchImpl,
    });

    await client.get("/api/v1/auth/me", {
      accessToken: " valid-token ",
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/auth/me", {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer valid-token",
      },
    });
  });

  it("maps the backend error contract to ApiClientError", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: "NOT_FOUND",
          message: "Nie znaleziono książki.",
          requestId: "request-404",
          details: [],
        },
        404,
      ),
    );
    const client = createApiClient({
      fetchImpl,
    });

    const error = await client.get("/api/v1/books/missing").catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Nie znaleziono książki.",
      requestId: "request-404",
      details: [],
    });
  });

  it("preserves backend validation details for POST errors", async () => {
    const details = [
      {
        field: "email",
        message: "email must be an email",
      },
    ];
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        {
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          requestId: "request-400",
          details,
        },
        400,
      ),
    );
    const client = createApiClient({
      fetchImpl,
    });

    const error = await client
      .post("/api/v1/auth/login", {
        email: "invalid",
        password: "secret",
      })
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      requestId: "request-400",
      details,
    });
  });

  it("rejects a successful response containing invalid JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html>", {
        status: 200,
      }),
    );
    const client = createApiClient({
      fetchImpl,
    });

    await expect(client.get("/api/v1/books")).rejects.toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
      message: "API zwróciło niepoprawny JSON.",
    });
  });
});

describe("createCatalogApi", () => {
  it("builds the public catalog query with stable parameter ordering", async () => {
    const response: PublicBookListResponse = {
      items: [],
      pagination: {
        page: 2,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    };
    const requestedPaths: string[] = [];
    const client = createReadOnlyClient(async <T>(path: string): Promise<T> => {
      requestedPaths.push(path);

      return response as T;
    });
    const api = createCatalogApi(client);

    await api.getBooks({
      page: 2,
      pageSize: 20,
      query: " TypeScript ",
      category: "programowanie",
      author: "jan-kowalski",
      sortBy: "price",
      sortOrder: "desc",
    });

    expect(requestedPaths).toEqual([
      "/api/v1/books?page=2&pageSize=20&query=TypeScript&category=programowanie&author=jan-kowalski&sortBy=price&sortOrder=desc",
    ]);
  });

  it("targets the details and dictionary endpoints", async () => {
    const requestedPaths: string[] = [];
    const client = createReadOnlyClient(async <T>(path: string): Promise<T> => {
      requestedPaths.push(path);

      return {} as T;
    });
    const api = createCatalogApi(client);

    await api.getBook("typescript / praktyka");
    await api.getAuthors();
    await api.getCategories();

    expect(requestedPaths).toEqual([
      "/api/v1/books/typescript%20%2F%20praktyka",
      "/api/v1/authors",
      "/api/v1/categories",
    ]);
  });
});

import type { ApiErrorResponse } from "@ebookstore/contracts";

export interface JsonApiClient {
  get<T>(path: string): Promise<T>;
}

export interface ApiClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

interface ApiClientErrorOptions {
  readonly status: number | null;
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details: readonly unknown[];
  readonly cause?: unknown;
}

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly requestId: string;
  readonly details: readonly unknown[];

  constructor(options: ApiClientErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function createRequestUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["code"] === "string" &&
    typeof value["message"] === "string" &&
    typeof value["requestId"] === "string" &&
    Array.isArray(value["details"])
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (responseText.trim().length === 0) {
    throw new ApiClientError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "API zwróciło pustą odpowiedź.",
      requestId: response.headers.get("x-request-id") ?? "unknown",
      details: [],
    });
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (cause) {
    throw new ApiClientError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "API zwróciło niepoprawny JSON.",
      requestId: response.headers.get("x-request-id") ?? "unknown",
      details: [],
      cause,
    });
  }
}

export function createApiClient(options: ApiClientOptions = {}): JsonApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async get<T>(path: string): Promise<T> {
      let response: Response;

      try {
        response = await fetchImpl(createRequestUrl(baseUrl, path), {
          headers: {
            Accept: "application/json",
          },
        });
      } catch (cause) {
        throw new ApiClientError({
          status: null,
          code: "NETWORK_ERROR",
          message: "Nie udało się połączyć z API.",
          requestId: "unknown",
          details: [],
          cause,
        });
      }

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        if (isApiErrorResponse(payload)) {
          throw new ApiClientError({
            status: response.status,
            code: payload.code,
            message: payload.message,
            requestId: payload.requestId,
            details: payload.details,
          });
        }

        throw new ApiClientError({
          status: response.status,
          code: "HTTP_ERROR",
          message: `Żądanie API zakończyło się statusem ${response.status}.`,
          requestId: response.headers.get("x-request-id") ?? "unknown",
          details: [],
        });
      }

      return payload as T;
    },
  };
}

import type { ApiErrorResponse } from "@ebookstore/contracts";

export interface ApiRequestOptions {
  readonly accessToken?: string;
}

export interface JsonApiClient {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T>;

  post<TResponse, TBody>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions,
  ): Promise<TResponse>;

  patch<TResponse, TBody>(
    path: string,
    body: TBody,
    options?: ApiRequestOptions,
  ): Promise<TResponse>;
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

function createRequestHeaders(
  options: ApiRequestOptions,
  includeContentType: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const accessToken = options.accessToken?.trim();

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return headers;
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

function serializeJsonBody(body: unknown): string {
  const serializedBody = JSON.stringify(body);

  if (serializedBody === undefined) {
    throw new TypeError("Request body must be JSON-serializable.");
  }

  return serializedBody;
}

export function createApiClient(options: ApiClientOptions = {}): JsonApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(path: string, requestInit: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetchImpl(createRequestUrl(baseUrl, path), requestInit);
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
  }

  function sendJson<TResponse, TBody>(
    method: "POST" | "PATCH",
    path: string,
    body: TBody,
    requestOptions: ApiRequestOptions,
  ): Promise<TResponse> {
    const serializedBody = serializeJsonBody(body);

    return request<TResponse>(path, {
      method,
      headers: createRequestHeaders(requestOptions, true),
      body: serializedBody,
    });
  }

  return {
    get<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
      return request<T>(path, {
        headers: createRequestHeaders(requestOptions, false),
      });
    },

    post<TResponse, TBody>(
      path: string,
      body: TBody,
      requestOptions: ApiRequestOptions = {},
    ): Promise<TResponse> {
      return sendJson<TResponse, TBody>("POST", path, body, requestOptions);
    },

    patch<TResponse, TBody>(
      path: string,
      body: TBody,
      requestOptions: ApiRequestOptions = {},
    ): Promise<TResponse> {
      return sendJson<TResponse, TBody>("PATCH", path, body, requestOptions);
    },
  };
}

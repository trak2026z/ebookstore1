import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
  type ArgumentsHost,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ApiExceptionFilter } from "./api-exception.filter";

describe("ApiExceptionFilter", () => {
  it("preserves an explicit domain error code", () => {
    const context = createHttpContext();
    const filter = new ApiExceptionFilter();

    filter.catch(
      new NotFoundException({
        code: "BOOK_NOT_FOUND",
        message: "Book not found.",
      }),
      context.host,
    );

    expect(context.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(context.json).toHaveBeenCalledWith({
      code: "BOOK_NOT_FOUND",
      message: "Book not found.",
      requestId: "request-id",
      details: [],
    });
  });

  it("uses the status fallback for a standard HTTP exception", () => {
    const context = createHttpContext();
    const filter = new ApiExceptionFilter();

    filter.catch(new NotFoundException("Resource not found."), context.host);

    expect(context.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(context.json).toHaveBeenCalledWith({
      code: "NOT_FOUND",
      message: "Resource not found.",
      requestId: "request-id",
      details: [],
    });
  });

  it("keeps validation messages in error details", () => {
    const context = createHttpContext();
    const filter = new ApiExceptionFilter();

    filter.catch(
      new BadRequestException({
        message: ["page must be an integer", "page must not be less than 1"],
      }),
      context.host,
    );

    expect(context.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(context.json).toHaveBeenCalledWith({
      code: "VALIDATION_ERROR",
      message: "page must be an integer",
      requestId: "request-id",
      details: ["page must be an integer", "page must not be less than 1"],
    });
  });
});

function createHttpContext(): {
  readonly host: ArgumentsHost;
  readonly status: ReturnType<typeof vi.fn>;
  readonly json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = {
    getHeader: vi.fn().mockReturnValue("request-id"),
    status,
  } as unknown as Response;
  const request = {
    header: vi.fn(),
  } as unknown as Request;
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    status,
    json,
  };
}

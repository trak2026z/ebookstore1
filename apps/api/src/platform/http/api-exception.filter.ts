import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ApiErrorResponse {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details: readonly unknown[];
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const httpResponse = httpContext.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    httpResponse.status(status).json(this.createPayload(exception, request, httpResponse));
  }

  private createPayload(
    exception: unknown,
    request: Request,
    httpResponse: Response,
  ): ApiErrorResponse {
    const requestId = this.resolveRequestId(request, httpResponse);

    if (!(exception instanceof HttpException)) {
      return {
        code: "INTERNAL_ERROR",
        message: "Wystąpił nieoczekiwany błąd.",
        requestId,
        details: [],
      };
    }

    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === "string") {
      return {
        code: this.codeFromStatus(exception.getStatus()),
        message: exceptionResponse,
        requestId,
        details: [],
      };
    }

    const responseBody = exceptionResponse as Record<string, unknown>;
    const codeValue = responseBody["code"];
    const messageValue = responseBody["message"];

    const messages = Array.isArray(messageValue)
      ? messageValue.filter((value): value is string => typeof value === "string")
      : [];

    const explicitCode = typeof codeValue === "string" ? codeValue.trim() : "";

    return {
      code: explicitCode || this.codeFromStatus(exception.getStatus()),
      message: typeof messageValue === "string" ? messageValue : (messages[0] ?? exception.message),
      requestId,
      details: messages,
    };
  }

  private resolveRequestId(request: Request, response: Response): string {
    const responseHeader = response.getHeader("x-request-id");

    if (typeof responseHeader === "string" && responseHeader.length > 0) {
      return responseHeader;
    }

    const requestHeader = request.header("x-request-id")?.trim();

    return requestHeader || "unknown";
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "VALIDATION_ERROR";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMITED";
      default:
        return status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR";
    }
  }
}

import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const suppliedRequestId = request.header(REQUEST_ID_HEADER)?.trim();
  const requestId = suppliedRequestId || randomUUID();

  response.locals["requestId"] = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

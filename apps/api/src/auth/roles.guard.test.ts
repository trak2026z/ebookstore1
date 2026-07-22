import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequest } from "./authenticated-request";
import type { UserRole } from "./roles.decorator";
import { ROLES_KEY } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };

  let guard: RolesGuard;

  beforeEach(() => {
    vi.clearAllMocks();

    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it("allows access when no roles are required", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it("allows access when an empty role list is configured", () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it("allows a user with one of the required roles", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN", "USER"] satisfies readonly UserRole[]);

    const context = createContext({
      role: "ADMIN",
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects an authenticated user without a required role", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] satisfies readonly UserRole[]);

    const context = createContext({
      role: "USER",
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("returns a generic forbidden error", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] satisfies readonly UserRole[]);

    const context = createContext({
      role: "USER",
    });

    expect(() => guard.canActivate(context)).toThrow("Insufficient permissions");
  });

  it("rejects a request without an authenticated user", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] satisfies readonly UserRole[]);

    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it("returns a generic unauthorized error", () => {
    reflector.getAllAndOverride.mockReturnValue(["ADMIN"] satisfies readonly UserRole[]);

    expect(() => guard.canActivate(createContext())).toThrow("Authentication required");
  });
});

function createContext(user?: { role: UserRole }): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = {};

  if (user) {
    request.user = {
      id: "user-id",
      email: "user@example.com",
      displayName: null,
      role: user.role,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  }

  const handler = vi.fn();
  const controller = class TestController {};

  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
  } as unknown as ExecutionContext;
}

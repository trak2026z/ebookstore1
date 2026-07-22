import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";

import type { UsersService } from "../users/users.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { UserRecord } from "./user-response";

const user: UserRecord = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  passwordHash: "hash",
  role: "USER",
  isActive: true,
  createdAt: new Date("2026-07-22T10:00:00.000Z"),
  updatedAt: new Date("2026-07-22T10:00:00.000Z"),
};

function setup(authorization?: string) {
  const request = {
    headers: authorization ? { authorization } : {},
  } as Request;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  const jwtService = { verifyAsync: vi.fn() };
  const usersService = { findById: vi.fn() };

  return {
    guard: new JwtAuthGuard(
      jwtService as unknown as JwtService,
      usersService as unknown as UsersService,
    ),
    context,
    request,
    jwtService,
    usersService,
  };
}

describe("JwtAuthGuard", () => {
  it("accepts a valid token and attaches the current user", async () => {
    const subject = setup("Bearer token");
    subject.jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    subject.usersService.findById.mockResolvedValue(user);

    await expect(subject.guard.canActivate(subject.context)).resolves.toBe(true);
    expect(subject.usersService.findById).toHaveBeenCalledWith(user.id);
    expect((subject.request as Request & { user?: unknown }).user).toMatchObject({
      id: user.id,
      email: user.email,
    });
  });

  it.each([undefined, "Basic token", "Bearer", "Bearer token extra"])(
    "rejects malformed authorization %j",
    async (header) => {
      const subject = setup(header);

      await expect(subject.guard.canActivate(subject.context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it.each([
    { payload: null, storedUser: user },
    { payload: { email: user.email }, storedUser: user },
    {
      payload: { sub: user.id, email: user.email, role: user.role },
      storedUser: null,
    },
    {
      payload: { sub: user.id, email: user.email, role: user.role },
      storedUser: { ...user, isActive: false },
    },
  ])("rejects invalid token context %#", async ({ payload, storedUser }) => {
    const subject = setup("Bearer token");
    subject.jwtService.verifyAsync.mockResolvedValue(payload);
    subject.usersService.findById.mockResolvedValue(storedUser);

    await expect(subject.guard.canActivate(subject.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects failed JWT verification", async () => {
    const subject = setup("Bearer token");
    subject.jwtService.verifyAsync.mockRejectedValue(new Error());

    await expect(subject.guard.canActivate(subject.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

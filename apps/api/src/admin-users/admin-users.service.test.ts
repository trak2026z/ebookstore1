import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import { AdminUsersService } from "./admin-users.service";

describe("AdminUsersService", () => {
  const findMany = vi.fn();
  const count = vi.fn();

  const database = {
    prisma: {
      user: {
        findMany,
        count,
      },
    },
  } as unknown as DatabaseService;

  let service: AdminUsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminUsersService(database);
  });

  it("returns a paginated list without exposing password hashes", async () => {
    findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "admin@example.com",
        displayName: "Administrator",
        role: "ADMIN",
        isActive: true,
        passwordHash: "must-not-leak",
        createdAt: new Date("2026-07-20T10:00:00.000Z"),
        updatedAt: new Date("2026-07-21T11:00:00.000Z"),
      },
    ]);
    count.mockResolvedValue(21);

    const response = await service.listUsers({
      page: 3,
      pageSize: 10,
    });

    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 20,
      take: 10,
    });

    expect(count).toHaveBeenCalledWith();

    expect(response).toEqual({
      items: [
        {
          id: "user-1",
          email: "admin@example.com",
          displayName: "Administrator",
          role: "ADMIN",
          isActive: true,
          createdAt: "2026-07-20T10:00:00.000Z",
          updatedAt: "2026-07-21T11:00:00.000Z",
        },
      ],
      pagination: {
        page: 3,
        pageSize: 10,
        total: 21,
        totalPages: 3,
      },
    });

    expect(response.items[0]).not.toHaveProperty("passwordHash");
  });

  it("returns an empty page with correct pagination metadata", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const response = await service.listUsers({
      page: 1,
      pageSize: 20,
    });

    expect(response).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });
});

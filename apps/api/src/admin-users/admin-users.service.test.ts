import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import { AdminUsersService } from "./admin-users.service";

describe("AdminUsersService", () => {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const count = vi.fn();
  const update = vi.fn();

  const transactionClient = {
    user: {
      findMany,
      findUnique,
      count,
      update,
    },
  };

  const transaction = vi.fn(
    async (callback: (client: typeof transactionClient) => unknown): Promise<unknown> =>
      callback(transactionClient),
  );

  const database = {
    prisma: {
      user: {
        findMany,
        findUnique,
        count,
        update,
      },
      $transaction: transaction,
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

  it("returns a user by ID without exposing the password hash", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Example User",
      role: "USER",
      isActive: true,
      passwordHash: "must-not-leak",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-21T11:00:00.000Z"),
    });

    const response = await service.getUserById("user-1");

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    expect(response).toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "Example User",
      role: "USER",
      isActive: true,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-21T11:00:00.000Z",
    });

    expect(response).not.toHaveProperty("passwordHash");
  });

  it("throws a not-found exception when the user does not exist", async () => {
    findUnique.mockResolvedValue(null);

    await expect(service.getUserById("missing-user")).rejects.toMatchObject({
      status: 404,
      message: "User not found",
    });
  });

  it("promotes a user and returns a safe response", async () => {
    findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Example User",
      role: "USER",
      isActive: true,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-21T11:00:00.000Z"),
    });
    update.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Example User",
      role: "ADMIN",
      isActive: true,
      passwordHash: "must-not-leak",
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-22T12:00:00.000Z"),
    });

    const response = await service.updateUserRole({
      userId: "user-1",
      role: "ADMIN",
    });

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(count).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "user-1",
      },
      data: {
        role: "ADMIN",
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(response).toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "Example User",
      role: "ADMIN",
      isActive: true,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-22T12:00:00.000Z",
    });
    expect(response).not.toHaveProperty("passwordHash");
  });

  it("returns the existing user without writing when the role is unchanged", async () => {
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      role: "ADMIN",
      isActive: true,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-21T11:00:00.000Z"),
    });

    const response = await service.updateUserRole({
      userId: "admin-1",
      role: "ADMIN",
    });

    expect(count).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(response.role).toBe("ADMIN");
  });

  it("throws a not-found exception when updating a missing user", async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.updateUserRole({
        userId: "missing-user",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "User not found",
    });

    expect(count).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("prevents demoting the last active administrator", async () => {
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      role: "ADMIN",
      isActive: true,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-21T11:00:00.000Z"),
    });
    count.mockResolvedValue(1);

    await expect(
      service.updateUserRole({
        userId: "admin-1",
        role: "USER",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Cannot remove the role of the last active administrator",
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        isActive: true,
      },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows demoting an administrator when another active administrator exists", async () => {
    findUnique.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      role: "ADMIN",
      isActive: true,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-21T11:00:00.000Z"),
    });
    count.mockResolvedValue(2);
    update.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      role: "USER",
      isActive: true,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
      updatedAt: new Date("2026-07-22T12:00:00.000Z"),
    });

    const response = await service.updateUserRole({
      userId: "admin-1",
      role: "USER",
    });

    expect(count).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        isActive: true,
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: {
        id: "admin-1",
      },
      data: {
        role: "USER",
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(response.role).toBe("USER");
  });
});

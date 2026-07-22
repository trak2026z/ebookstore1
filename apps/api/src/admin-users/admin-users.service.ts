import { Inject, Injectable } from "@nestjs/common";

import type { AdminUserListResponse } from "@ebookstore/contracts";

import { DatabaseService } from "../database/database.service";

export interface ListAdminUsersInput {
  readonly page: number;
  readonly pageSize: number;
}

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  async listUsers(input: ListAdminUsersInput): Promise<AdminUserListResponse> {
    const skip = (input.page - 1) * input.pageSize;

    const [users, total] = await Promise.all([
      this.database.prisma.user.findMany({
        select: ADMIN_USER_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take: input.pageSize,
      }),
      this.database.prisma.user.count(),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }
}

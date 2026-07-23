import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type {
  AdminUserListItem,
  AdminUserListResponse,
  AdminUserRole,
} from "@ebookstore/contracts";

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

interface SelectedAdminUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: AdminUserRole;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toAdminUserListItem(user: SelectedAdminUser): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

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
      items: users.map(toAdminUserListItem),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }

  async getUserById(id: string): Promise<AdminUserListItem> {
    const user = await this.database.prisma.user.findUnique({
      where: { id },
      select: ADMIN_USER_SELECT,
    });

    if (user === null) {
      throw new NotFoundException("User not found");
    }

    return toAdminUserListItem(user);
  }
}

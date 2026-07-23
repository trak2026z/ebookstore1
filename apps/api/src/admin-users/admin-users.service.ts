import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

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

export interface UpdateAdminUserRoleInput {
  readonly userId: string;
  readonly role: AdminUserRole;
}

export interface UpdateAdminUserStatusInput {
  readonly userId: string;
  readonly isActive: boolean;
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

  async updateUserRole(input: UpdateAdminUserRoleInput): Promise<AdminUserListItem> {
    return this.database.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: input.userId },
          select: ADMIN_USER_SELECT,
        });

        if (user === null) {
          throw new NotFoundException("User not found");
        }

        if (user.role === input.role) {
          return toAdminUserListItem(user);
        }

        if (user.role === "ADMIN" && input.role === "USER" && user.isActive) {
          const activeAdminCount = await transaction.user.count({
            where: {
              role: "ADMIN",
              isActive: true,
            },
          });

          if (activeAdminCount <= 1) {
            throw new ConflictException("Cannot remove the role of the last active administrator");
          }
        }

        const updatedUser = await transaction.user.update({
          where: { id: input.userId },
          data: { role: input.role },
          select: ADMIN_USER_SELECT,
        });

        return toAdminUserListItem(updatedUser);
      },
      {
        isolationLevel: "Serializable",
      },
    );
  }

  async updateUserStatus(input: UpdateAdminUserStatusInput): Promise<AdminUserListItem> {
    return this.database.prisma.$transaction(
      async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: input.userId },
          select: ADMIN_USER_SELECT,
        });

        if (user === null) {
          throw new NotFoundException("User not found");
        }

        if (user.isActive === input.isActive) {
          return toAdminUserListItem(user);
        }

        if (user.role === "ADMIN" && user.isActive && input.isActive === false) {
          const activeAdminCount = await transaction.user.count({
            where: {
              role: "ADMIN",
              isActive: true,
            },
          });

          if (activeAdminCount <= 1) {
            throw new ConflictException("Cannot deactivate the last active administrator");
          }
        }

        const updatedUser = await transaction.user.update({
          where: { id: input.userId },
          data: { isActive: input.isActive },
          select: ADMIN_USER_SELECT,
        });

        return toAdminUserListItem(updatedUser);
      },
      {
        isolationLevel: "Serializable",
      },
    );
  }
}

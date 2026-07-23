import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";

import type { AdminUserListResponse } from "@ebookstore/contracts";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminUsersService } from "./admin-users.service";
// Runtime import is required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListAdminUsersQueryDto } from "./dto/list-admin-users-query.dto";

@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminUsersController {
  constructor(
    @Inject(AdminUsersService)
    private readonly adminUsers: AdminUsersService,
  ) {}

  @Get()
  listUsers(@Query() query: ListAdminUsersQueryDto): Promise<AdminUserListResponse> {
    return this.adminUsers.listUsers({
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}

import type { AdminUserRole, UpdateAdminUserRoleRequest } from "@ebookstore/contracts";
import { IsIn } from "class-validator";

const ADMIN_USER_ROLES = ["USER", "ADMIN"] as const satisfies readonly AdminUserRole[];

export class UpdateAdminUserRoleDto implements UpdateAdminUserRoleRequest {
  @IsIn(ADMIN_USER_ROLES)
  role!: AdminUserRole;
}

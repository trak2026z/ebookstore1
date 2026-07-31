import { Transform, Type, type TransformFnParams } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import type { AdminUserRole } from "@ebookstore/contracts";

export const ADMIN_USER_STATUS_FILTERS = ["active", "inactive"] as const;

export type AdminUserStatusFilter = (typeof ADMIN_USER_STATUS_FILTERS)[number];

const ADMIN_USER_ROLES = ["USER", "ADMIN"] as const;

function trimOptionalText({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() || undefined : value;
}

export class ListAdminUsersQueryDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @Transform(trimOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @Transform(trimOptionalText)
  @IsOptional()
  @IsIn(ADMIN_USER_ROLES)
  role?: AdminUserRole;

  @Transform(trimOptionalText)
  @IsOptional()
  @IsIn(ADMIN_USER_STATUS_FILTERS)
  status?: AdminUserStatusFilter;
}

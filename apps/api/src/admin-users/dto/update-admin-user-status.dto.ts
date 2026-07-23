import type { UpdateAdminUserStatusRequest } from "@ebookstore/contracts";
import { IsBoolean } from "class-validator";

export class UpdateAdminUserStatusDto implements UpdateAdminUserStatusRequest {
  @IsBoolean()
  isActive!: boolean;
}

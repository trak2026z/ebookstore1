import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

export type UserRole = "USER" | "ADMIN";

export const Roles = (...roles: readonly UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

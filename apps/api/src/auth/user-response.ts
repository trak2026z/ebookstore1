import type { AuthUserResponse, AuthUserRole } from "@ebookstore/contracts";

export type UserResponse = AuthUserResponse;

export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: AuthUserRole;
  readonly createdAt: Date;
  readonly passwordHash: string;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

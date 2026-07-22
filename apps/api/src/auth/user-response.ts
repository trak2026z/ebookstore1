export interface UserResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: "USER" | "ADMIN";
  createdAt: Date;
}

export interface UserRecord extends UserResponse {
  passwordHash: string;
  isActive: boolean;
  updatedAt: Date;
}

export function toUserResponse(user: UserRecord): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

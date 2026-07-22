import type { UserResponse } from "./user-response";

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: UserResponse;
}

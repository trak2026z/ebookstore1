import type { Request } from "express";

import type { UserResponse } from "./user-response";

export interface AuthenticatedRequest extends Request {
  user: UserResponse;
}

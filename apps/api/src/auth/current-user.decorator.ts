import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedRequest } from "./authenticated-request";
import type { UserResponse } from "./user-response";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserResponse => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);

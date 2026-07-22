import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedRequest } from "./authenticated-request";
import type { UserRole } from "./roles.decorator";
import { ROLES_KEY } from "./roles.decorator";

const UNAUTHORIZED_MESSAGE = "Authentication required";
const FORBIDDEN_MESSAGE = "Insufficient permissions";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<readonly UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();

    if (!request.user) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return true;
  }
}

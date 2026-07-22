import {
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

import { UsersService } from "../users/users.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { isJwtPayload } from "./jwt-payload";
import { toUserResponse } from "./user-response";

const UNAUTHORIZED_MESSAGE = "Authentication required";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(UsersService)
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    try {
      const payload =
        await this.jwtService.verifyAsync<Record<string, unknown>>(
    token,
  );

      if (!isJwtPayload(payload)) {
        throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
      }

      const user = await this.usersService.findById(payload.sub);

      if (user === null || !user.isActive) {
        throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
      }

      (request as AuthenticatedRequest).user =
        toUserResponse(user);

      return true;
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;

    if (authorization === undefined) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    const [scheme, token, extra] = authorization.split(" ");

    if (
      scheme?.toLowerCase() !== "bearer" ||
      token === undefined ||
      token.length === 0 ||
      extra !== undefined
    ) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    return token;
  }
}

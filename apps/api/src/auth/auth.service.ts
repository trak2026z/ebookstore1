import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { normalizeEmail } from "../users/normalize-email";
import { UsersService } from "../users/users.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { parseJwtConfig } from "./jwt-config";
import type { LoginResponse } from "./login-response";
import { PasswordService } from "./password.service";
import {
  toUserResponse,
  type UserResponse,
} from "./user-response";

const EMAIL_CONFLICT_MESSAGE =
  "An account with this email already exists";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService)
    private readonly usersService: UsersService,

    @Inject(PasswordService)
    private readonly passwordService: PasswordService,

    @Inject(JwtService)
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponse> {
    const email = normalizeEmail(dto.email);
    const existingUser =
      await this.usersService.findByEmail(email);

    if (existingUser !== null) {
      throw new ConflictException(
        EMAIL_CONFLICT_MESSAGE,
      );
    }

    const passwordHash =
      await this.passwordService.hash(dto.password);

    try {
      const user = await this.usersService.create({
        email,
        passwordHash,
        ...(dto.displayName === undefined
          ? {}
          : { displayName: dto.displayName }),
      });

      return toUserResponse(user);
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          EMAIL_CONFLICT_MESSAGE,
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);

    if (user === null || !user.isActive) {
      throw new UnauthorizedException(
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    const passwordMatches =
      await this.passwordService.verify(
        user.passwordHash,
        dto.password,
      );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        INVALID_CREDENTIALS_MESSAGE,
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const jwtConfig = parseJwtConfig(process.env);

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: jwtConfig.accessTokenTtlSeconds,
      user: toUserResponse(user),
    };
  }
}

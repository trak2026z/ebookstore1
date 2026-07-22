import {
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { normalizeEmail } from "../users/normalize-email";
import { UsersService } from "../users/users.service";
import type { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";
import {
  toUserResponse,
  type UserResponse,
} from "./user-response";

const EMAIL_CONFLICT_MESSAGE =
  "An account with this email already exists";

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
}
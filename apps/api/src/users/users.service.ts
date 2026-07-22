import { Inject, Injectable } from "@nestjs/common";

import type { UserRecord } from "../auth/user-response";
import { DatabaseService } from "../database/database.service";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.database.prisma.user.findUnique({
      where: { email },
    }) as Promise<UserRecord | null>;
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.database.prisma.user.findUnique({
      where: { id },
    }) as Promise<UserRecord | null>;
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    return this.database.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: "USER",
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      },
    }) as Promise<UserRecord>;
  }
}

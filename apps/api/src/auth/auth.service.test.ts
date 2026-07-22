import {
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { UsersService } from "../users/users.service";
import { AuthService } from "./auth.service";
import type { PasswordService } from "./password.service";
import type { UserRecord } from "./user-response";

const user: UserRecord = {
  id: "165461e5-e713-47c5-9ae4-3b84f81a8430",
  email: "user@example.com",
  displayName: "Tomasz",
  passwordHash: "argon2-hash",
  role: "USER",
  isActive: true,
  createdAt: new Date(
    "2026-07-22T10:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-07-22T10:00:00.000Z",
  ),
};

function createSubject() {
  const usersService = {
    findByEmail: vi.fn(),
    create: vi.fn(),
  };
  const passwordService = {
    hash: vi.fn(),
    verify: vi.fn(),
  };
  const jwtService = {
    signAsync: vi.fn(),
  };

  return {
    subject: new AuthService(
      usersService as unknown as UsersService,
      passwordService as unknown as PasswordService,
      jwtService as unknown as JwtService,
    ),
    usersService,
    passwordService,
    jwtService,
  };
}

describe("AuthService", () => {
  it("normalizes the email, hashes the password and returns a safe response", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue(
      "argon2-hash",
    );
    usersService.create.mockResolvedValue(user);

    await expect(
      subject.register({
        email: " User@Example.com ",
        password: "Correct-Horse-42",
        displayName: "Tomasz",
      }),
    ).resolves.toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: "USER",
      createdAt: user.createdAt,
    });

    expect(
      usersService.findByEmail,
    ).toHaveBeenCalledWith(
      "user@example.com",
    );
    expect(
      passwordService.hash,
    ).toHaveBeenCalledWith(
      "Correct-Horse-42",
    );
    expect(
      usersService.create,
    ).toHaveBeenCalledWith({
      email: "user@example.com",
      passwordHash: "argon2-hash",
      displayName: "Tomasz",
    });
  });

  it("rejects an existing email before hashing", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      subject.register({
        email: user.email,
        password: "Correct-Horse-42",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      passwordService.hash,
    ).not.toHaveBeenCalled();
    expect(
      usersService.create,
    ).not.toHaveBeenCalled();
  });

  it("maps a Prisma unique constraint race to HTTP 409", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(null);
    passwordService.hash.mockResolvedValue(
      "argon2-hash",
    );
    usersService.create.mockRejectedValue({
      code: "P2002",
    });

    await expect(
      subject.register({
        email: user.email,
        password: "Correct-Horse-42",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns a JWT for valid credentials", async () => {
    const {
      subject,
      usersService,
      passwordService,
      jwtService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue(
      "signed.jwt.token",
    );

    await expect(
      subject.login({
        email: " USER@Example.com ",
        password: "Correct-Horse-42",
      }),
    ).resolves.toEqual({
      accessToken: "signed.jwt.token",
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
      },
    });

    expect(
      usersService.findByEmail,
    ).toHaveBeenCalledWith(
      "user@example.com",
    );
    expect(
      passwordService.verify,
    ).toHaveBeenCalledWith(
      user.passwordHash,
      "Correct-Horse-42",
    );
    expect(
      jwtService.signAsync,
    ).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  });

  it("uses the same unauthorized response for an unknown email", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      subject.login({
        email: "missing@example.com",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      response: {
        message: "Invalid email or password",
      },
    });

    expect(
      passwordService.verify,
    ).not.toHaveBeenCalled();
  });

  it("rejects an invalid password", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue(user);
    passwordService.verify.mockResolvedValue(false);

    await expect(
      subject.login({
        email: user.email,
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects an inactive account before checking its password", async () => {
    const {
      subject,
      usersService,
      passwordService,
    } = createSubject();
    usersService.findByEmail.mockResolvedValue({
      ...user,
      isActive: false,
    });

    await expect(
      subject.login({
        email: user.email,
        password: "Correct-Horse-42",
      }),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(
      passwordService.verify,
    ).not.toHaveBeenCalled();
  });
});

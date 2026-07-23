import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import type { UserRecord } from "../auth/user-response";
import { DatabaseModule } from "../database/database.module";
import { DatabaseService } from "../database/database.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersModule } from "./admin-users.module";
import { AdminUsersService } from "./admin-users.service";

const ADMIN_ID = "admin-user-id";
const JWT_SECRET = "admin-users-module-integration-test-secret";

function createUserRecord(role: UserRecord["role"]): UserRecord {
  return {
    id: ADMIN_ID,
    email: "admin@example.com",
    passwordHash: "unused-in-this-test",
    displayName: "Administrator",
    role,
    isActive: true,
    createdAt: new Date("2026-07-20T10:00:00.000Z"),
    updatedAt: new Date("2026-07-23T12:00:00.000Z"),
  };
}

describe("AdminUsersModule integration", () => {
  const originalJwtSecret = process.env["JWT_SECRET"];
  const originalJwtAccessTokenTtlSeconds = process.env["JWT_ACCESS_TOKEN_TTL_SECONDS"];

  const findMany = vi.fn();
  const findUnique = vi.fn();
  const count = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn();
  const ping = vi.fn();

  const database = {
    prisma: {
      user: {
        findMany,
        findUnique,
        count,
        update,
      },
      $transaction: transaction,
    },
    ping,
  } as unknown as DatabaseService;

  let testingModule: TestingModule | undefined;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    vi.resetAllMocks();

    process.env["JWT_SECRET"] = JWT_SECRET;
    process.env["JWT_ACCESS_TOKEN_TTL_SECONDS"] = "900";

    testingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AdminUsersModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(database)
      .compile();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
      testingModule = undefined;
    } else {
      await testingModule?.close();
      testingModule = undefined;
    }

    if (originalJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = originalJwtSecret;
    }

    if (originalJwtAccessTokenTtlSeconds === undefined) {
      delete process.env["JWT_ACCESS_TOKEN_TTL_SECONDS"];
    } else {
      process.env["JWT_ACCESS_TOKEN_TTL_SECONDS"] = originalJwtAccessTokenTtlSeconds;
    }
  });

  it("resolves the complete dependency graph", () => {
    expect(testingModule?.get(AdminUsersController)).toBeInstanceOf(AdminUsersController);
    expect(testingModule?.get(AdminUsersService)).toBeInstanceOf(AdminUsersService);
    expect(testingModule?.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
    expect(testingModule?.get(RolesGuard)).toBeInstanceOf(RolesGuard);
    expect(testingModule?.get(DatabaseService)).toBe(database);
  });

  it("initializes the HTTP application with the real authentication guard", async () => {
    app = testingModule!.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    await request(app.getHttpServer()).get("/api/v1/admin/users").expect(401);

    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it("authorizes an administrator using a real signed JWT", async () => {
    findUnique.mockResolvedValue(createUserRecord("ADMIN"));
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const jwtService = testingModule!.get(JwtService);
    const accessToken = await jwtService.signAsync({
      sub: ADMIN_ID,
      email: "admin@example.com",
      role: "ADMIN",
    });

    app = testingModule!.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: ADMIN_ID,
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 0,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith();
    expect(response.body).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it("uses the current database role instead of trusting a stale token role", async () => {
    findUnique.mockResolvedValue(createUserRecord("USER"));

    const jwtService = testingModule!.get(JwtService);
    const accessToken = await jwtService.signAsync({
      sub: ADMIN_ID,
      email: "admin@example.com",
      role: "ADMIN",
    });

    app = testingModule!.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(403);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: ADMIN_ID,
      },
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});

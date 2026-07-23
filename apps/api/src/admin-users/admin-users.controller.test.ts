import {
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("AdminUsersController", () => {
  let app: INestApplication | undefined;

  const adminUsersService = {
    listUsers: vi.fn(),
    getUserById: vi.fn(),
  };

  const jwtAuthGuard: CanActivate = {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const authorization = request.headers.authorization;

      if (authorization === undefined) {
        throw new UnauthorizedException("Authentication required");
      }

      if (authorization === "Bearer admin-token") {
        request.user = {
          id: "admin-id",
          email: "admin@example.com",
          displayName: "Administrator",
          role: "ADMIN",
          createdAt: new Date("2026-07-20T10:00:00.000Z"),
        };

        return true;
      }

      if (authorization === "Bearer user-token") {
        request.user = {
          id: "user-id",
          email: "user@example.com",
          displayName: "User",
          role: "USER",
          createdAt: new Date("2026-07-20T10:00:00.000Z"),
        };

        return true;
      }

      throw new UnauthorizedException("Authentication required");
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const testingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: AdminUsersService,
          useValue: adminUsersService,
        },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuard)
      .compile();

    app = testingModule.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns HTTP 401 without an access token", async () => {
    await request(app!.getHttpServer()).get("/api/v1/admin/users").expect(401);

    expect(adminUsersService.listUsers).not.toHaveBeenCalled();
  });

  it("returns HTTP 403 for an authenticated non-admin user", async () => {
    await request(app!.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", "Bearer user-token")
      .expect(403);

    expect(adminUsersService.listUsers).not.toHaveBeenCalled();
  });

  it("returns HTTP 200 for an administrator and applies default pagination", async () => {
    adminUsersService.listUsers.mockResolvedValue({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });

    const response = await request(app!.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(response.body).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
    expect(adminUsersService.listUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("transforms valid pagination query parameters", async () => {
    adminUsersService.listUsers.mockResolvedValue({
      items: [],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 0,
        totalPages: 0,
      },
    });

    await request(app!.getHttpServer())
      .get("/api/v1/admin/users")
      .query({
        page: "2",
        pageSize: "5",
      })
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(adminUsersService.listUsers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
    });
  });

  it("rejects pagination values outside the allowed range", async () => {
    await request(app!.getHttpServer())
      .get("/api/v1/admin/users")
      .query({
        page: "0",
        pageSize: "101",
      })
      .set("Authorization", "Bearer admin-token")
      .expect(400);

    expect(adminUsersService.listUsers).not.toHaveBeenCalled();
  });

  it("rejects unknown query parameters", async () => {
    await request(app!.getHttpServer())
      .get("/api/v1/admin/users")
      .query({
        includePasswordHash: "true",
      })
      .set("Authorization", "Bearer admin-token")
      .expect(400);

    expect(adminUsersService.listUsers).not.toHaveBeenCalled();
  });

  it("returns HTTP 401 for user details without an access token", async () => {
    await request(app!.getHttpServer()).get(`/api/v1/admin/users/${USER_ID}`).expect(401);

    expect(adminUsersService.getUserById).not.toHaveBeenCalled();
  });

  it("returns HTTP 403 for user details requested by a non-admin user", async () => {
    await request(app!.getHttpServer())
      .get(`/api/v1/admin/users/${USER_ID}`)
      .set("Authorization", "Bearer user-token")
      .expect(403);

    expect(adminUsersService.getUserById).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 for an invalid user ID", async () => {
    await request(app!.getHttpServer())
      .get("/api/v1/admin/users/not-a-uuid")
      .set("Authorization", "Bearer admin-token")
      .expect(400);

    expect(adminUsersService.getUserById).not.toHaveBeenCalled();
  });

  it("returns HTTP 404 when the requested user does not exist", async () => {
    adminUsersService.getUserById.mockRejectedValue(new NotFoundException("User not found"));

    await request(app!.getHttpServer())
      .get(`/api/v1/admin/users/${USER_ID}`)
      .set("Authorization", "Bearer admin-token")
      .expect(404);

    expect(adminUsersService.getUserById).toHaveBeenCalledWith(USER_ID);
  });

  it("returns HTTP 200 with user details for an administrator", async () => {
    adminUsersService.getUserById.mockResolvedValue({
      id: USER_ID,
      email: "user@example.com",
      displayName: "Example User",
      role: "USER",
      isActive: true,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-21T11:00:00.000Z",
    });

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/admin/users/${USER_ID}`)
      .set("Authorization", "Bearer admin-token")
      .expect(200);

    expect(adminUsersService.getUserById).toHaveBeenCalledWith(USER_ID);
    expect(response.body).toEqual({
      id: USER_ID,
      email: "user@example.com",
      displayName: "Example User",
      role: "USER",
      isActive: true,
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-21T11:00:00.000Z",
    });
    expect(response.body).not.toHaveProperty("passwordHash");
  });
});

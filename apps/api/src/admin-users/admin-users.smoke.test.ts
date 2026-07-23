import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { configureApp } from "../platform/configure-app";

const runDatabaseSmokeTests = process.env["RUN_DATABASE_SMOKE_TESTS"] === "1";
const describeDatabaseSmoke = runDatabaseSmokeTests ? describe : describe.skip;

describeDatabaseSmoke("Admin users PostgreSQL smoke", () => {
  const uniqueSuffix = randomUUID().replaceAll("-", "");
  const adminEmail = `smoke-admin-${uniqueSuffix}@example.invalid`;
  const managedUserEmail = `smoke-user-${uniqueSuffix}@example.invalid`;

  let testingModule: TestingModule | undefined;
  let app: INestApplication | undefined;
  let database: DatabaseService | undefined;
  let accessToken = "";
  let adminId = "";
  let managedUserId = "";

  beforeAll(async () => {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Database smoke tests must not run in production.");
    }

    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    configureApp(app);
    await app.init();

    database = app.get(DatabaseService);

    const [admin, managedUser] = await database.prisma.$transaction([
      database.prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: "unused-smoke-test-password-hash",
          displayName: "Smoke Test Administrator",
          role: "ADMIN",
          isActive: true,
        },
      }),
      database.prisma.user.create({
        data: {
          email: managedUserEmail,
          passwordHash: "unused-smoke-test-password-hash",
          displayName: "Smoke Test User",
          role: "USER",
          isActive: true,
        },
      }),
    ]);

    adminId = admin.id;
    managedUserId = managedUser.id;

    const jwtService = app.get(JwtService);
    accessToken = await jwtService.signAsync({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
  });

  afterAll(async () => {
    if (database !== undefined && (adminId !== "" || managedUserId !== "")) {
      await database.prisma.user.deleteMany({
        where: {
          id: {
            in: [adminId, managedUserId].filter((id) => id !== ""),
          },
        },
      });
    }

    if (app !== undefined) {
      await app.close();
      app = undefined;
      testingModule = undefined;
    } else {
      await testingModule?.close();
      testingModule = undefined;
    }
  });

  it("executes the complete admin user flow against PostgreSQL", async () => {
    const httpServer = app!.getHttpServer();
    const authorization = `Bearer ${accessToken}`;

    const listResponse = await request(httpServer)
      .get("/api/v1/admin/users")
      .query({
        page: 1,
        pageSize: 100,
      })
      .set("Authorization", authorization)
      .expect(200);

    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: managedUserId,
          email: managedUserEmail,
          role: "USER",
          isActive: true,
        }),
      ]),
    );

    const detailsResponse = await request(httpServer)
      .get(`/api/v1/admin/users/${managedUserId}`)
      .set("Authorization", authorization)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      id: managedUserId,
      email: managedUserEmail,
      role: "USER",
      isActive: true,
    });
    expect(detailsResponse.body).not.toHaveProperty("passwordHash");

    const roleResponse = await request(httpServer)
      .patch(`/api/v1/admin/users/${managedUserId}/role`)
      .set("Authorization", authorization)
      .send({
        role: "ADMIN",
      })
      .expect(200);

    expect(roleResponse.body).toMatchObject({
      id: managedUserId,
      role: "ADMIN",
      isActive: true,
    });
    expect(roleResponse.body).not.toHaveProperty("passwordHash");

    const statusResponse = await request(httpServer)
      .patch(`/api/v1/admin/users/${managedUserId}/status`)
      .set("Authorization", authorization)
      .send({
        isActive: false,
      })
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      id: managedUserId,
      role: "ADMIN",
      isActive: false,
    });
    expect(statusResponse.body).not.toHaveProperty("passwordHash");

    const persistedUser = await database!.prisma.user.findUniqueOrThrow({
      where: {
        id: managedUserId,
      },
    });

    expect(persistedUser).toMatchObject({
      email: managedUserEmail,
      role: "ADMIN",
      isActive: false,
    });
  });
});

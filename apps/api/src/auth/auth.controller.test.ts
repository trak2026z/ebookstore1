import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let app: INestApplication;
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
  };

  beforeEach(async () => {
    const testingModule =
      await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: authService,
          },
        ],
      }).compile();

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
    vi.clearAllMocks();
    await app.close();
  });

  it("returns HTTP 200 and the login response", async () => {
    authService.login.mockResolvedValue({
      accessToken: "signed.jwt.token",
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        id: "user-id",
        email: "user@example.com",
        displayName: "Tomasz",
        role: "USER",
        createdAt: new Date(
          "2026-07-22T10:00:00.000Z",
        ),
      },
    });

    const response = await request(
      app.getHttpServer(),
    )
      .post("/api/v1/auth/login")
      .send({
        email: " USER@Example.com ",
        password: "Correct-Horse-42",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      accessToken: "signed.jwt.token",
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        email: "user@example.com",
      },
    });
    expect(
      authService.login,
    ).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Correct-Horse-42",
    });
  });

  it("rejects an invalid email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "not-an-email",
        password: "Correct-Horse-42",
      })
      .expect(400);

    expect(
      authService.login,
    ).not.toHaveBeenCalled();
  });

  it("rejects unknown request properties", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "user@example.com",
        password: "Correct-Horse-42",
        role: "ADMIN",
      })
      .expect(400);

    expect(
      authService.login,
    ).not.toHaveBeenCalled();
  });
});

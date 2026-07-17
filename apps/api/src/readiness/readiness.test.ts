import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { configureApp } from "../platform/configure-app";

describe("Readiness API", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it("returns ready when the database responds", async () => {
    app = await createApp();

    const response = await request(app.getHttpServer()).get("/api/v1/ready").expect(200);

    expect(response.body).toEqual({
      status: "ready",
      checks: {
        database: "ok",
      },
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    const ping = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("database unavailable"));

    app = await createApp((builder) =>
      builder.overrideProvider(DatabaseService).useValue({
        ping,
      }),
    );

    const response = await request(app.getHttpServer())
      .get("/api/v1/ready")
      .set("x-request-id", "req-readiness-failure")
      .expect(503);

    expect(response.body).toEqual({
      code: "INTERNAL_ERROR",
      message: "Database is unavailable.",
      requestId: "req-readiness-failure",
      details: [],
    });
  });

  async function createApp(
    customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
  ): Promise<INestApplication> {
    const builder = Test.createTestingModule({
      imports: [AppModule],
    });

    const testingModule = await customize(builder).compile();
    const application = testingModule.createNestApplication();

    configureApp(application);
    await application.init();

    return application;
  }
});

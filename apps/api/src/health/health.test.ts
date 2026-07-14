import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { configureApp } from "../platform/configure-app";

describe("Health API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns the application health status", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);

    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("preserves a client request ID", async () => {
    const requestId = "req-health-test";

    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-request-id", requestId)
      .expect(200);

    expect(response.headers["x-request-id"]).toBe(requestId);
  });
});

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { configureApp } from "../platform/configure-app";
import { CatalogService } from "./catalog.service";

describe("Catalog API", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns a paginated book list", async () => {
    app = await createApp({
      getBooks: vi.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
      getBookBySlug: vi.fn(),
    });

    const response = await request(app.getHttpServer()).get("/api/v1/books").expect(200);

    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejects a page size above the limit", async () => {
    app = await createApp({
      getBooks: vi.fn(),
      getBookBySlug: vi.fn(),
    });

    await request(app.getHttpServer()).get("/api/v1/books?pageSize=101").expect(400);
  });

  async function createApp(catalog: {
    getBooks: ReturnType<typeof vi.fn>;
    getBookBySlug: ReturnType<typeof vi.fn>;
  }): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ ping: vi.fn() })
      .overrideProvider(CatalogService)
      .useValue(catalog)
      .compile();

    const application = module.createNestApplication();
    configureApp(application);
    await application.init();
    return application;
  }
});

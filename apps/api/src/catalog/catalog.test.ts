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
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    app = await createApp({
      getBooks,
      getBookBySlug: vi.fn(),
    });

    const response = await request(app.getHttpServer()).get("/api/v1/books").expect(200);

    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(getBooks).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it("normalizes catalog query parameters before calling the service", async () => {
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 2, pageSize: 25, total: 0, totalPages: 0 },
    });

    app = await createApp({
      getBooks,
      getBookBySlug: vi.fn(),
    });

    await request(app.getHttpServer())
      .get("/api/v1/books?page=%202%20&pageSize=%2025%20&category=%20fiction%20&q=%20dune%20")
      .expect(200);

    expect(getBooks).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      category: "fiction",
      q: "dune",
    });
  });

  it("omits an empty search query before calling the service", async () => {
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    app = await createApp({
      getBooks,
      getBookBySlug: vi.fn(),
    });

    await request(app.getHttpServer()).get("/api/v1/books?q=%20%20%20").expect(200);

    expect(getBooks).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it.each(["/api/v1/books?page=0", "/api/v1/books?page=1.5", "/api/v1/books?pageSize=101"])(
    "rejects an invalid catalog query: %s",
    async (url) => {
      const getBooks = vi.fn();

      app = await createApp({
        getBooks,
        getBookBySlug: vi.fn(),
      });

      const response = await request(app.getHttpServer()).get(url).expect(400);

      expect(response.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.any(String),
        requestId: expect.any(String),
        details: [],
      });
      expect(getBooks).not.toHaveBeenCalled();
    },
  );

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

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

  it("returns the public author dictionary", async () => {
    const getAuthors = vi.fn().mockResolvedValue({
      items: [
        { name: "Octavia E. Butler", slug: "octavia-e-butler" },
        { name: "Ursula K. Le Guin", slug: "ursula-k-le-guin" },
      ],
    });
    app = await createApp({
      getAuthors,
      getBooks: vi.fn(),
      getBookBySlug: vi.fn(),
    });

    const response = await request(app.getHttpServer()).get("/api/v1/authors").expect(200);

    expect(response.body).toEqual({
      items: [
        { name: "Octavia E. Butler", slug: "octavia-e-butler" },
        { name: "Ursula K. Le Guin", slug: "ursula-k-le-guin" },
      ],
    });
    expect(getAuthors).toHaveBeenCalledOnce();
  });

  it("returns the public category dictionary", async () => {
    const getCategories = vi.fn().mockResolvedValue({
      items: [
        { name: "Fantasy", slug: "fantasy" },
        { name: "Science Fiction", slug: "science-fiction" },
      ],
    });
    app = await createApp({
      getCategories,
      getBooks: vi.fn(),
      getBookBySlug: vi.fn(),
    });

    const response = await request(app.getHttpServer()).get("/api/v1/categories").expect(200);

    expect(response.body).toEqual({
      items: [
        { name: "Fantasy", slug: "fantasy" },
        { name: "Science Fiction", slug: "science-fiction" },
      ],
    });
    expect(getCategories).toHaveBeenCalledOnce();
  });

  it("returns a paginated book list", async () => {
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    app = await createApp({ getBooks, getBookBySlug: vi.fn() });

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
      sort: "newest",
    });
  });

  it("normalizes all catalog query parameters before calling the service", async () => {
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 2, pageSize: 25, total: 0, totalPages: 0 },
    });

    app = await createApp({ getBooks, getBookBySlug: vi.fn() });

    await request(app.getHttpServer())
      .get(
        "/api/v1/books?page=%202%20&pageSize=%2025%20&category=%20fiction%20&author=%20ursula-le-guin%20&q=%20earthsea%20&sort=%20price-desc%20",
      )
      .expect(200);

    expect(getBooks).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      category: "fiction",
      author: "ursula-le-guin",
      q: "earthsea",
      sort: "price-desc",
    });
  });

  it("omits empty optional filters before calling the service", async () => {
    const getBooks = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    app = await createApp({ getBooks, getBookBySlug: vi.fn() });

    await request(app.getHttpServer()).get("/api/v1/books?q=%20%20&author=%20%20").expect(200);

    expect(getBooks).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sort: "newest",
    });
  });

  it.each([
    "/api/v1/books?page=0",
    "/api/v1/books?page=1.5",
    "/api/v1/books?pageSize=101",
    "/api/v1/books?sort=unknown",
  ])("rejects an invalid catalog query: %s", async (url) => {
    const getBooks = vi.fn();

    app = await createApp({ getBooks, getBookBySlug: vi.fn() });

    const response = await request(app.getHttpServer()).get(url).expect(400);

    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.any(String),
      requestId: expect.any(String),
      details: [],
    });
    expect(getBooks).not.toHaveBeenCalled();
  });

  async function createApp(catalogService: {
    getAuthors?: ReturnType<typeof vi.fn>;
    getCategories?: ReturnType<typeof vi.fn>;
    getBooks: ReturnType<typeof vi.fn>;
    getBookBySlug: ReturnType<typeof vi.fn>;
  }): Promise<INestApplication> {
    const service = {
      getAuthors: vi.fn().mockResolvedValue({ items: [] }),
      getCategories: vi.fn().mockResolvedValue({ items: [] }),
      ...catalogService,
    };
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ ping: vi.fn() })
      .overrideProvider(CatalogService)
      .useValue(service)
      .compile();

    const application = module.createNestApplication();
    configureApp(application);
    await application.init();
    return application;
  }
});

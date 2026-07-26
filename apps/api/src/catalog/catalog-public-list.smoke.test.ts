import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PublicBookListResponse } from "@ebookstore/contracts";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { BookFormat, BookStatus } from "../generated/prisma/enums.js";
import { configureApp } from "../platform/configure-app";

const runSmoke = process.env["RUN_DATABASE_SMOKE_TESTS"] === "1";
const describeSmoke = runSmoke ? describe : describe.skip;
const privateFields = [
  "coverKey",
  "priceMinor",
  "status",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const;

describeSmoke("Public catalog list PostgreSQL smoke", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const prefix = `catalog-smoke-${suffix}`;
  const ids = {
    authors: [randomUUID(), randomUUID()],
    categories: [randomUUID(), randomUUID()],
    books: Array.from({ length: 5 }, () => randomUUID()),
  };
  const authorSlugs = [`${prefix}-author-a`, `${prefix}-author-b`];
  const categorySlugs = [`${prefix}-category-a`, `${prefix}-category-b`];
  const publishedSlugs = [
    `${prefix}-zulu-typescript`,
    `${prefix}-alpha-node`,
    `${prefix}-middle-api`,
  ];
  const coverKey = `covers/${prefix}.jpg`;
  let app: INestApplication | undefined;
  let database: DatabaseService | undefined;

  beforeAll(async () => {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Database smoke tests must not run in production.");
    }

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    database = app.get(DatabaseService);

    await database.prisma.$transaction([
      database.prisma.author.createMany({
        data: ids.authors.map((id, index) => ({
          id,
          name: `${prefix} Author ${index}`,
          displayName: `${prefix} Author ${index}`,
          slug: authorSlugs[index]!,
        })),
      }),
      database.prisma.category.createMany({
        data: ids.categories.map((id, index) => ({
          id,
          name: `${prefix} Category ${index}`,
          slug: categorySlugs[index]!,
        })),
      }),
    ]);

    const books = [
      [
        publishedSlugs[0],
        `${prefix} Zulu TypeScript`,
        2990,
        "2024-02-01",
        BookStatus.PUBLISHED,
        coverKey,
      ],
      [publishedSlugs[1], `${prefix} Alpha Node`, 7990, "2024-01-01", BookStatus.PUBLISHED, null],
      [publishedSlugs[2], `${prefix} Middle API`, 4990, "2024-03-01", BookStatus.PUBLISHED, null],
      [`${prefix}-draft`, `${prefix} Draft TypeScript`, 1990, "2024-04-01", BookStatus.DRAFT, null],
      [
        `${prefix}-withdrawn`,
        `${prefix} Withdrawn`,
        9990,
        "2024-05-01",
        BookStatus.WITHDRAWN,
        null,
      ],
    ] as const;

    await database.prisma.$transaction([
      database.prisma.book.createMany({
        data: books.map(([slug, title, priceMinor, date, status, key], index) => ({
          id: ids.books[index]!,
          title,
          slug,
          isbn: `${suffix}-${index}`,
          description: `Database smoke fixture ${index}.`,
          priceMinor,
          currency: "PLN",
          status,
          format: BookFormat.EPUB,
          coverKey: key,
          createdAt: new Date(`${date}T00:00:00.000Z`),
        })),
      }),
      database.prisma.bookAuthor.createMany({
        data: [
          ...ids.books.map((bookId) => ({
            bookId,
            authorId: ids.authors[0]!,
            position: 0,
          })),
          { bookId: ids.books[0]!, authorId: ids.authors[1]!, position: 1 },
        ],
      }),
      database.prisma.bookCategory.createMany({
        data: [
          ...ids.books.map((bookId) => ({
            bookId,
            categoryId: ids.categories[0]!,
            position: 0,
          })),
          { bookId: ids.books[0]!, categoryId: ids.categories[1]!, position: 1 },
        ],
      }),
    ]);
  });

  afterAll(async () => {
    if (database !== undefined) {
      await database.prisma.book.deleteMany({
        where: { id: { in: ids.books } },
      });
      await database.prisma.author.deleteMany({
        where: { id: { in: ids.authors } },
      });
      await database.prisma.category.deleteMany({
        where: { id: { in: ids.categories } },
      });
    }
    await app?.close();
  });

  it("returns only public books and relations without private fields", async () => {
    const body = await getBooks({ category: categorySlugs[0]! });
    expect(slugs(body)).toEqual([publishedSlugs[2], publishedSlugs[0], publishedSlugs[1]]);
    expect(body.items[1]).toMatchObject({
      slug: publishedSlugs[0],
      authors: [{ slug: authorSlugs[0] }, { slug: authorSlugs[1] }],
      categories: [{ slug: categorySlugs[0] }, { slug: categorySlugs[1] }],
      price: { amountMinor: 2990, currency: "PLN" },
      coverUrl: `/api/v1/books/${ids.books[0]}/cover`,
    });
    expectNoPrivateFields(body);
    expect(JSON.stringify(body)).not.toContain(coverKey);
    expect(JSON.stringify(body)).not.toContain("/workspace/storage");
  });

  it("supports empty results, pagination, search, filters and sorting", async () => {
    expect(await getBooks({ query: `missing-${suffix}` })).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    });

    const first = await getBooks({
      category: categorySlugs[0]!,
      page: 1,
      pageSize: 2,
    });
    const second = await getBooks({
      category: categorySlugs[0]!,
      page: 2,
      pageSize: 2,
    });
    expect(first.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
    });
    expect(second.pagination.page).toBe(2);
    expect(new Set([...slugs(first), ...slugs(second)]).size).toBe(3);

    expect(slugs(await getBooks({ query: "  TypeScript  " }))).toContain(publishedSlugs[0]);
    expect(slugs(await getBooks({ category: categorySlugs[1]! }))).toEqual([publishedSlugs[0]]);
    expect(slugs(await getBooks({ author: authorSlugs[1]! }))).toEqual([publishedSlugs[0]]);

    const cases = [
      ["title", [publishedSlugs[1], publishedSlugs[2], publishedSlugs[0]]],
      ["price", [publishedSlugs[0], publishedSlugs[2], publishedSlugs[1]]],
      ["createdAt", [publishedSlugs[1], publishedSlugs[0], publishedSlugs[2]]],
    ] as const;
    for (const [sortBy, ascending] of cases) {
      const query = { category: categorySlugs[0]!, sortBy };
      expect(slugs(await getBooks({ ...query, sortOrder: "asc" }))).toEqual(ascending);
      expect(slugs(await getBooks({ ...query, sortOrder: "desc" }))).toEqual(
        [...ascending].reverse(),
      );
    }
  });

  it.each([{ pageSize: 101 }, { sortBy: "unknown" }, { sortOrder: "sideways" }])(
    "rejects invalid query %j",
    async (query) => {
      const response = await request(app!.getHttpServer())
        .get("/api/v1/books")
        .query(query)
        .expect(400);
      expect(response.body).toMatchObject({
        code: "VALIDATION_ERROR",
        requestId: expect.any(String),
        details: [],
      });
    },
  );

  async function getBooks(query: Record<string, string | number>): Promise<PublicBookListResponse> {
    const response = await request(app!.getHttpServer())
      .get("/api/v1/books")
      .query(query)
      .expect(200);
    return response.body as PublicBookListResponse;
  }
});

function slugs(response: PublicBookListResponse): string[] {
  return response.items.map(({ slug }) => slug);
}

function expectNoPrivateFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoPrivateFields);
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    privateFields.forEach((field) => expect(record).not.toHaveProperty(field));
    Object.values(record).forEach(expectNoPrivateFields);
  }
}

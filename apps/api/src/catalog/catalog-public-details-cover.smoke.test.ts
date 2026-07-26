import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PublicBookDetailsResponse } from "@ebookstore/contracts";

import { AppModule } from "../app.module";
import { APP_CONFIG } from "../config/app-config";
import { parseEnvironment } from "../config/parse-environment";
import { DatabaseService } from "../database/database.service";
import { BookFormat, BookStatus } from "../generated/prisma/enums.js";
import { configureApp } from "../platform/configure-app";

const describeSmoke = process.env["RUN_DATABASE_SMOKE_TESTS"] === "1" ? describe : describe.skip;
const jpegContent = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
const privateFields = [
  "coverKey",
  "priceMinor",
  "status",
  "publishedAt",
  "createdAt",
  "updatedAt",
] as const;

describeSmoke("Public catalog details and cover PostgreSQL smoke", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const prefix = `catalog-details-smoke-${suffix}`;
  const authorIds = [randomUUID(), randomUUID()];
  const categoryIds = [randomUUID(), randomUUID()];
  const bookIds = Array.from({ length: 5 }, () => randomUUID());
  const slugs = ["public", "no-cover", "missing-file", "draft", "withdrawn"].map(
    (value) => `${prefix}-${value}`,
  );
  const coverKeys = {
    public: `covers/${prefix}-public.jpg`,
    missing: `covers/${prefix}-missing.jpg`,
    draft: `covers/${prefix}-draft.jpg`,
    withdrawn: `covers/${prefix}-withdrawn.jpg`,
  };
  let app: INestApplication | undefined;
  let database: DatabaseService | undefined;
  let storageRoot = "";

  beforeAll(async () => {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Database smoke tests must not run in production.");
    }

    storageRoot = await mkdtemp(join(tmpdir(), "ebookstore-cover-smoke-"));
    await mkdir(join(storageRoot, "covers"));
    await Promise.all(
      [coverKeys.public, coverKeys.draft, coverKeys.withdrawn].map((key) =>
        writeFile(join(storageRoot, key), jpegContent),
      ),
    );

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue({ ...parseEnvironment(process.env), coverStorageRoot: storageRoot })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    database = app.get(DatabaseService);

    await database.prisma.$transaction([
      database.prisma.author.createMany({
        data: authorIds.map((id, index) => ({
          id,
          name: `${prefix} Author ${index}`,
          displayName: `${prefix} Author ${index}`,
          slug: `${prefix}-author-${index}`,
        })),
      }),
      database.prisma.category.createMany({
        data: categoryIds.map((id, index) => ({
          id,
          name: `${prefix} Category ${index}`,
          slug: `${prefix}-category-${index}`,
        })),
      }),
    ]);

    const books = [
      [BookStatus.PUBLISHED, coverKeys.public],
      [BookStatus.PUBLISHED, null],
      [BookStatus.PUBLISHED, coverKeys.missing],
      [BookStatus.DRAFT, coverKeys.draft],
      [BookStatus.WITHDRAWN, coverKeys.withdrawn],
    ] as const;
    await database.prisma.$transaction([
      database.prisma.book.createMany({
        data: books.map(([status, coverKey], index) => ({
          id: bookIds[index]!,
          title: `${prefix} Book ${index}`,
          slug: slugs[index]!,
          isbn: `${suffix}-${index}`,
          description: `Details smoke fixture ${index}.`,
          priceMinor: 7990 + index,
          currency: "PLN",
          status,
          format: BookFormat.EPUB,
          coverKey,
          coverUrl: "https://storage.example/private-cover",
        })),
      }),
      database.prisma.bookAuthor.createMany({
        data: authorIds.map((authorId, position) => ({
          bookId: bookIds[0]!,
          authorId,
          position,
        })),
      }),
      database.prisma.bookCategory.createMany({
        data: categoryIds.map((categoryId, position) => ({
          bookId: bookIds[0]!,
          categoryId,
          position,
        })),
      }),
    ]);
  });

  afterAll(async () => {
    try {
      if (database !== undefined) {
        await database.prisma.book.deleteMany({
          where: { id: { in: bookIds } },
        });
        await database.prisma.author.deleteMany({
          where: { id: { in: authorIds } },
        });
        await database.prisma.category.deleteMany({
          where: { id: { in: categoryIds } },
        });
      }
    } finally {
      await app?.close();
      if (storageRoot) {
        await rm(storageRoot, { recursive: true, force: true });
      }
    }
  });

  it("returns public details with ordered relations and no private data", async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/books/${slugs[0]}`)
      .expect(200);
    const body = response.body as PublicBookDetailsResponse;

    expect(body).toMatchObject({
      id: bookIds[0],
      slug: slugs[0],
      title: `${prefix} Book 0`,
      isbn: `${suffix}-0`,
      description: "Details smoke fixture 0.",
      authors: authorIds.map((id, index) => ({
        id,
        displayName: `${prefix} Author ${index}`,
        slug: `${prefix}-author-${index}`,
      })),
      categories: categoryIds.map((id, index) => ({
        id,
        name: `${prefix} Category ${index}`,
        slug: `${prefix}-category-${index}`,
      })),
      price: { amountMinor: 7990, currency: "PLN" },
      format: "EPUB",
      coverUrl: `/api/v1/books/${bookIds[0]}/cover`,
    });
    expectNoPrivateFields(body);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("storage.example");
    expect(serialized).not.toContain(coverKeys.public);
    expect(serialized).not.toContain(storageRoot);
  });

  it.each([slugs[3]!, slugs[4]!, `${prefix}-missing`])(
    "hides non-public or missing details for %s",
    async (slug) => {
      const response = await request(app!.getHttpServer()).get(`/api/v1/books/${slug}`).expect(404);
      expectSafeError(response.body as unknown, "BOOK_NOT_FOUND");
    },
  );

  it("streams the published JPEG with exact headers and bytes", async () => {
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/books/${bookIds[0]}/cover`)
      .expect(200);

    expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
    expect(response.headers["content-length"]).toBe(String(jpegContent.length));
    expect(Buffer.from(response.body)).toEqual(jpegContent);
  });

  it("handles missing cover keys and files without leaking storage data", async () => {
    const noCover = await request(app!.getHttpServer())
      .get(`/api/v1/books/${slugs[1]}`)
      .expect(200);
    expect(noCover.body).toMatchObject({ coverUrl: null });
    expectSafeError(
      (await request(app!.getHttpServer()).get(`/api/v1/books/${bookIds[1]}/cover`).expect(404))
        .body,
      "BOOK_COVER_NOT_FOUND",
    );

    const missingFile = await request(app!.getHttpServer())
      .get(`/api/v1/books/${slugs[2]}`)
      .expect(200);
    expect(missingFile.body).toMatchObject({
      coverUrl: `/api/v1/books/${bookIds[2]}/cover`,
    });
    const response = await request(app!.getHttpServer())
      .get(`/api/v1/books/${bookIds[2]}/cover`)
      .expect(404);
    expectSafeError(response.body as unknown, "BOOK_COVER_NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain(coverKeys.missing);
  });

  it("hides non-public and missing covers and rejects an invalid UUID", async () => {
    for (const id of [bookIds[3]!, bookIds[4]!, randomUUID()]) {
      const response = await request(app!.getHttpServer())
        .get(`/api/v1/books/${id}/cover`)
        .expect(404);
      expectSafeError(response.body as unknown, "BOOK_COVER_NOT_FOUND");
    }
    const invalid = await request(app!.getHttpServer())
      .get("/api/v1/books/not-a-uuid/cover")
      .expect(400);
    expectSafeError(invalid.body as unknown, "VALIDATION_ERROR");
  });
});

function expectSafeError(value: unknown, code: string): void {
  expect(value).toMatchObject({
    code,
    message: expect.any(String),
    requestId: expect.any(String),
    details: [],
  });
  const serialized = JSON.stringify(value);
  ["coverKey", "ENOENT", "/tmp/", "/workspace/storage"].forEach((secret) =>
    expect(serialized).not.toContain(secret),
  );
}

function expectNoPrivateFields(value: unknown): void {
  if (Array.isArray(value)) value.forEach(expectNoPrivateFields);
  else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    privateFields.forEach((field) => expect(record).not.toHaveProperty(field));
    Object.values(record).forEach(expectNoPrivateFields);
  }
}

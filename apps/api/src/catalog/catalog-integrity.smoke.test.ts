import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { BookFormat, BookStatus } from "../generated/prisma/enums.js";

const runDatabaseSmokeTests = process.env["RUN_DATABASE_SMOKE_TESTS"] === "1";
const describeDatabaseSmoke = runDatabaseSmokeTests ? describe : describe.skip;

describeDatabaseSmoke("Catalog PostgreSQL integrity smoke", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const primaryAuthorSlug = `smoke-author-${suffix}`;
  const secondaryAuthorSlug = `smoke-author-2-${suffix}`;
  const primaryCategorySlug = `smoke-category-${suffix}`;
  const secondaryCategorySlug = `smoke-category-2-${suffix}`;
  const bookSlug = `smoke-book-${suffix}`;
  const bookIsbn = `smoke-isbn-${suffix}`;

  let testingModule: TestingModule | undefined;
  let app: INestApplication | undefined;
  let database: DatabaseService | undefined;
  let bookId = "";
  let primaryAuthorId = "";
  let secondaryAuthorId = "";
  let primaryCategoryId = "";
  let secondaryCategoryId = "";

  beforeAll(async () => {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Database smoke tests must not run in production.");
    }

    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    await app.init();

    database = app.get(DatabaseService);

    const [primaryAuthor, secondaryAuthor, primaryCategory, secondaryCategory] =
      await database.prisma.$transaction([
        database.prisma.author.create({
          data: {
            name: "Smoke Primary Author",
            displayName: "Smoke Primary Author",
            slug: primaryAuthorSlug,
          },
        }),
        database.prisma.author.create({
          data: {
            name: "Smoke Secondary Author",
            displayName: "Smoke Secondary Author",
            slug: secondaryAuthorSlug,
          },
        }),
        database.prisma.category.create({
          data: {
            name: "Smoke Primary Category",
            slug: primaryCategorySlug,
          },
        }),
        database.prisma.category.create({
          data: {
            name: "Smoke Secondary Category",
            slug: secondaryCategorySlug,
          },
        }),
      ]);

    primaryAuthorId = primaryAuthor.id;
    secondaryAuthorId = secondaryAuthor.id;
    primaryCategoryId = primaryCategory.id;
    secondaryCategoryId = secondaryCategory.id;

    const book = await database.prisma.book.create({
      data: {
        title: "Smoke Integrity Book",
        slug: bookSlug,
        isbn: bookIsbn,
        description: "Temporary database integrity fixture.",
        priceMinor: 100,
        currency: "PLN",
        status: BookStatus.DRAFT,
        format: BookFormat.PDF,
      },
    });

    bookId = book.id;

    await database.prisma.$transaction([
      database.prisma.bookAuthor.create({
        data: {
          bookId,
          authorId: primaryAuthorId,
          position: 0,
        },
      }),
      database.prisma.bookCategory.create({
        data: {
          bookId,
          categoryId: primaryCategoryId,
          position: 0,
        },
      }),
    ]);
  });

  afterAll(async () => {
    if (database !== undefined) {
      if (bookId !== "") {
        await database.prisma.book.deleteMany({
          where: {
            id: bookId,
          },
        });
      }

      const authorIds = [primaryAuthorId, secondaryAuthorId].filter((id) => id !== "");

      if (authorIds.length > 0) {
        await database.prisma.author.deleteMany({
          where: {
            id: {
              in: authorIds,
            },
          },
        });
      }

      const categoryIds = [primaryCategoryId, secondaryCategoryId].filter((id) => id !== "");

      if (categoryIds.length > 0) {
        await database.prisma.category.deleteMany({
          where: {
            id: {
              in: categoryIds,
            },
          },
        });
      }
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

  it("rejects a negative book price", async () => {
    const slug = `negative-price-${suffix}`;

    await expect(
      database!.prisma.book.create({
        data: {
          title: "Invalid Negative Price",
          slug,
          isbn: `negative-price-${suffix}`,
          description: "Must not be persisted.",
          priceMinor: -1,
          currency: "PLN",
          status: BookStatus.DRAFT,
          format: BookFormat.PDF,
        },
      }),
    ).rejects.toThrow();

    await expect(
      database!.prisma.book.findUnique({
        where: { slug },
      }),
    ).resolves.toBeNull();
  });

  it("rejects a malformed currency code", async () => {
    const slug = `invalid-currency-${suffix}`;

    await expect(
      database!.prisma.book.create({
        data: {
          title: "Invalid Currency",
          slug,
          isbn: `invalid-currency-${suffix}`,
          description: "Must not be persisted.",
          priceMinor: 100,
          currency: "pln",
          status: BookStatus.DRAFT,
          format: BookFormat.PDF,
        },
      }),
    ).rejects.toThrow();

    await expect(
      database!.prisma.book.findUnique({
        where: { slug },
      }),
    ).resolves.toBeNull();
  });

  it("rejects a negative author position", async () => {
    await expect(
      database!.prisma.bookAuthor.create({
        data: {
          bookId,
          authorId: secondaryAuthorId,
          position: -1,
        },
      }),
    ).rejects.toThrow();

    await expect(
      database!.prisma.bookAuthor.findUnique({
        where: {
          bookId_authorId: {
            bookId,
            authorId: secondaryAuthorId,
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("rejects a negative category position", async () => {
    await expect(
      database!.prisma.bookCategory.create({
        data: {
          bookId,
          categoryId: secondaryCategoryId,
          position: -1,
        },
      }),
    ).rejects.toThrow();

    await expect(
      database!.prisma.bookCategory.findUnique({
        where: {
          bookId_categoryId: {
            bookId,
            categoryId: secondaryCategoryId,
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("keeps ISBN unique", async () => {
    await expect(
      database!.prisma.book.create({
        data: {
          title: "Duplicate ISBN",
          slug: `duplicate-isbn-${suffix}`,
          isbn: bookIsbn,
          description: "Must not be persisted.",
          priceMinor: 100,
          currency: "PLN",
          status: BookStatus.DRAFT,
          format: BookFormat.PDF,
        },
      }),
    ).rejects.toThrow();
  });

  it("keeps the book slug unique", async () => {
    await expect(
      database!.prisma.book.create({
        data: {
          title: "Duplicate Slug",
          slug: bookSlug,
          isbn: `duplicate-slug-${suffix}`,
          description: "Must not be persisted.",
          priceMinor: 100,
          currency: "PLN",
          status: BookStatus.DRAFT,
          format: BookFormat.PDF,
        },
      }),
    ).rejects.toThrow();
  });

  it("creates the expected catalog indexes", async () => {
    const indexes = await database!.prisma.$queryRaw<readonly { indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN (
          'books',
          'book_authors',
          'book_categories'
        )
    `;

    const indexNames = new Set(indexes.map((index) => index.indexname));

    for (const expectedIndex of [
      "books_isbn_key",
      "books_slug_key",
      "books_title_idx",
      "books_status_created_at_id_idx",
      "book_authors_author_id_book_id_idx",
      "book_authors_book_id_position_author_id_idx",
      "book_categories_category_id_book_id_idx",
      "book_categories_book_id_position_category_id_idx",
    ]) {
      expect(indexNames.has(expectedIndex)).toBe(true);
    }
  });
});

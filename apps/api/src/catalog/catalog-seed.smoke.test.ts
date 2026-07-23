import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { DatabaseService } from "../database/database.service";
import { CATALOG_SEED, isValidIsbn13, seedCatalog } from "./catalog-seed";

const runDatabaseSmokeTests = process.env["RUN_DATABASE_SMOKE_TESTS"] === "1";
const describeDatabaseSmoke = runDatabaseSmokeTests ? describe : describe.skip;

describeDatabaseSmoke("Catalog seed PostgreSQL smoke", () => {
  let testingModule: TestingModule | undefined;
  let app: INestApplication | undefined;
  let database: DatabaseService | undefined;

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
  });

  afterAll(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
      testingModule = undefined;
    } else {
      await testingModule?.close();
      testingModule = undefined;
    }
  });

  it("is idempotent across consecutive executions", async () => {
    await seedCatalog(database!.prisma);
    const firstSnapshot = await getSeedSnapshot(database!);

    await seedCatalog(database!.prisma);
    const secondSnapshot = await getSeedSnapshot(database!);

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(secondSnapshot).toEqual({
      authors: CATALOG_SEED.authors.length,
      categories: CATALOG_SEED.categories.length,
      books: CATALOG_SEED.books.length,
      authorRelations: 7,
      categoryRelations: 7,
    });
  });

  it("persists every lifecycle status and valid ISBN", async () => {
    await seedCatalog(database!.prisma);

    const books = await database!.prisma.book.findMany({
      where: {
        slug: {
          in: CATALOG_SEED.books.map((book) => book.slug),
        },
      },
      select: {
        slug: true,
        isbn: true,
        status: true,
      },
      orderBy: {
        slug: "asc",
      },
    });

    expect(books).toHaveLength(CATALOG_SEED.books.length);
    expect(new Set(books.map((book) => book.status))).toEqual(
      new Set(["DRAFT", "PUBLISHED", "WITHDRAWN"]),
    );

    for (const book of books) {
      expect(isValidIsbn13(book.isbn)).toBe(true);
    }
  });

  it("persists ordered many-to-many relations", async () => {
    await seedCatalog(database!.prisma);

    const book = await database!.prisma.book.findUnique({
      where: {
        slug: "typescript-w-praktyce",
      },
      select: {
        authors: {
          select: {
            position: true,
            author: {
              select: {
                slug: true,
              },
            },
          },
          orderBy: [{ position: "asc" }, { authorId: "asc" }],
        },
        categories: {
          select: {
            position: true,
            category: {
              select: {
                slug: true,
              },
            },
          },
          orderBy: [{ position: "asc" }, { categoryId: "asc" }],
        },
      },
    });

    expect(book).toEqual({
      authors: [
        {
          position: 0,
          author: {
            slug: "marcin-kowalski",
          },
        },
        {
          position: 1,
          author: {
            slug: "anna-nowak",
          },
        },
      ],
      categories: [
        {
          position: 0,
          category: {
            slug: "programowanie",
          },
        },
        {
          position: 1,
          category: {
            slug: "architektura-oprogramowania",
          },
        },
      ],
    });
  });

  it("repairs stale relations on another execution", async () => {
    await seedCatalog(database!.prisma);

    const book = await database!.prisma.book.findUniqueOrThrow({
      where: {
        slug: "refaktoryzacja-javascript",
      },
      select: {
        id: true,
      },
    });

    const category = await database!.prisma.category.findUniqueOrThrow({
      where: {
        slug: "bezpieczenstwo",
      },
      select: {
        id: true,
      },
    });

    await database!.prisma.bookCategory.upsert({
      where: {
        bookId_categoryId: {
          bookId: book.id,
          categoryId: category.id,
        },
      },
      update: {
        position: 99,
      },
      create: {
        bookId: book.id,
        categoryId: category.id,
        position: 99,
      },
    });

    await seedCatalog(database!.prisma);

    const relations = await database!.prisma.bookCategory.findMany({
      where: {
        bookId: book.id,
      },
      select: {
        position: true,
        category: {
          select: {
            slug: true,
          },
        },
      },
      orderBy: [{ position: "asc" }, { categoryId: "asc" }],
    });

    expect(relations).toEqual([
      {
        position: 0,
        category: {
          slug: "programowanie",
        },
      },
    ]);
  });
});

async function getSeedSnapshot(database: DatabaseService): Promise<{
  readonly authors: number;
  readonly categories: number;
  readonly books: number;
  readonly authorRelations: number;
  readonly categoryRelations: number;
}> {
  const books = await database.prisma.book.findMany({
    where: {
      slug: {
        in: CATALOG_SEED.books.map((book) => book.slug),
      },
    },
    select: {
      id: true,
    },
  });

  const bookIds = books.map((book) => book.id);

  const [authors, categories, authorRelations, categoryRelations] =
    await database.prisma.$transaction([
      database.prisma.author.count({
        where: {
          slug: {
            in: CATALOG_SEED.authors.map((author) => author.slug),
          },
        },
      }),
      database.prisma.category.count({
        where: {
          slug: {
            in: CATALOG_SEED.categories.map((category) => category.slug),
          },
        },
      }),
      database.prisma.bookAuthor.count({
        where: {
          bookId: {
            in: bookIds,
          },
        },
      }),
      database.prisma.bookCategory.count({
        where: {
          bookId: {
            in: bookIds,
          },
        },
      }),
    ]);

  return {
    authors,
    categories,
    books: books.length,
    authorRelations,
    categoryRelations,
  };
}

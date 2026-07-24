import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../database/database.service";
import { BookStatus } from "../../generated/prisma/enums.js";
import type { CatalogSort } from "../catalog-query";
import { BooksRepository } from "./books.repository";

const PUBLIC_BOOK_RELATIONS = {
  authors: {
    select: {
      author: {
        select: {
          id: true,
          displayName: true,
          slug: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { authorId: "asc" }],
  },
  categories: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { categoryId: "asc" }],
  },
} as const;

describe("BooksRepository", () => {
  it("loads a published page with all public relations and stable defaults", async () => {
    const { database, findMany, count } = createDatabaseMock();
    const repository = new BooksRepository(database);

    await expect(
      repository.findPublishedPage({
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toEqual({
      items: [],
      total: 0,
    });

    const where = {
      status: BookStatus.PUBLISHED,
    };

    expect(findMany).toHaveBeenCalledWith({
      where,
      include: PUBLIC_BOOK_RELATIONS,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: 10,
      take: 10,
    });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it("combines category, author and text filters", async () => {
    const { database, findMany, count } = createDatabaseMock();
    const repository = new BooksRepository(database);

    await repository.findPublishedPage({
      page: 1,
      pageSize: 20,
      category: "programowanie",
      author: "marcin-kowalski",
      q: "typescript",
    });

    const where = {
      status: BookStatus.PUBLISHED,
      categories: {
        some: {
          category: {
            slug: "programowanie",
          },
        },
      },
      authors: {
        some: {
          author: {
            slug: "marcin-kowalski",
          },
        },
      },
      OR: [
        {
          title: {
            contains: "typescript",
            mode: "insensitive",
          },
        },
        {
          authors: {
            some: {
              author: {
                displayName: {
                  contains: "typescript",
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it("loads a published book by slug", async () => {
    const { database, findFirst } = createDatabaseMock();
    const repository = new BooksRepository(database);

    await repository.findPublishedBySlug("typescript-w-praktyce");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        slug: "typescript-w-praktyce",
        status: BookStatus.PUBLISHED,
      },
      include: PUBLIC_BOOK_RELATIONS,
    });
  });

  it.each([
    [undefined, [{ createdAt: "desc" }, { id: "asc" }]],
    ["newest", [{ createdAt: "desc" }, { id: "asc" }]],
    ["oldest", [{ createdAt: "asc" }, { id: "asc" }]],
    ["price-asc", [{ priceMinor: "asc" }, { id: "asc" }]],
    ["price-desc", [{ priceMinor: "desc" }, { id: "asc" }]],
    ["title-asc", [{ title: "asc" }, { id: "asc" }]],
    ["title-desc", [{ title: "desc" }, { id: "asc" }]],
  ] satisfies readonly [CatalogSort | undefined, readonly Record<string, "asc" | "desc">[]][])(
    "maps sort %s to Prisma ordering",
    async (sort, expectedOrderBy) => {
      const { database, findMany } = createDatabaseMock();
      const repository = new BooksRepository(database);

      await repository.findPublishedPage({
        page: 1,
        pageSize: 20,
        ...(sort === undefined ? {} : { sort }),
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expectedOrderBy,
        }),
      );
    },
  );
});

function createDatabaseMock(): {
  readonly database: DatabaseService;
  readonly findMany: ReturnType<typeof vi.fn>;
  readonly findFirst: ReturnType<typeof vi.fn>;
  readonly count: ReturnType<typeof vi.fn>;
  readonly transaction: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const count = vi.fn().mockResolvedValue(0);
  const transaction = vi.fn().mockResolvedValue([[], 0]);

  return {
    database: {
      prisma: {
        book: {
          findMany,
          findFirst,
          count,
        },
        $transaction: transaction,
      },
    } as unknown as DatabaseService,
    findMany,
    findFirst,
    count,
    transaction,
  };
}

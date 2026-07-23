import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import type { CatalogSort } from "./catalog-query";
import { CatalogService } from "./catalog.service";

const PUBLIC_BOOK_RELATIONS = {
  author: {
    select: {
      displayName: true,
      slug: true,
    },
  },
  category: {
    select: {
      name: true,
      slug: true,
    },
  },
} as const;

describe("CatalogService", () => {
  it("maps canonical author display names to the public contract", async () => {
    const { database, findAuthors } = createDatabaseMock();
    findAuthors.mockResolvedValue([
      {
        displayName: "Octavia E. Butler",
        slug: "octavia-e-butler",
      },
      {
        displayName: "Ursula K. Le Guin",
        slug: "ursula-k-le-guin",
      },
    ]);
    const service = new CatalogService(database);

    await expect(service.getAuthors()).resolves.toEqual({
      items: [
        {
          name: "Octavia E. Butler",
          slug: "octavia-e-butler",
        },
        {
          name: "Ursula K. Le Guin",
          slug: "ursula-k-le-guin",
        },
      ],
    });
    expect(findAuthors).toHaveBeenCalledWith({
      select: {
        displayName: true,
        slug: true,
      },
      orderBy: [{ displayName: "asc" }, { slug: "asc" }],
    });
  });

  it("returns the public category dictionary in a stable order", async () => {
    const { database, findCategories } = createDatabaseMock();
    const categories = [
      { name: "Fantasy", slug: "fantasy" },
      {
        name: "Science Fiction",
        slug: "science-fiction",
      },
    ];
    findCategories.mockResolvedValue(categories);
    const service = new CatalogService(database);

    await expect(service.getCategories()).resolves.toEqual({
      items: categories,
    });
    expect(findCategories).toHaveBeenCalledWith({
      select: {
        name: true,
        slug: true,
      },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
    });
  });

  it("filters books by author slug", async () => {
    const { database, findMany, count } = createDatabaseMock();
    const service = new CatalogService(database);

    await service.getBooks({
      page: 1,
      pageSize: 20,
      author: "ursula-le-guin",
    });

    const expectedWhere = {
      status: "PUBLISHED",
      author: { is: { slug: "ursula-le-guin" } },
    };

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 0,
        take: 20,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("combines author, category and text filters", async () => {
    const { database, findMany, count } = createDatabaseMock();
    const service = new CatalogService(database);

    await service.getBooks({
      page: 2,
      pageSize: 10,
      category: "science-fiction",
      author: "ursula-le-guin",
      q: "earthsea",
    });

    const expectedWhere = {
      status: "PUBLISHED",
      category: { slug: "science-fiction" },
      author: { is: { slug: "ursula-le-guin" } },
      OR: [
        {
          title: {
            contains: "earthsea",
            mode: "insensitive",
          },
        },
        {
          author: {
            is: {
              displayName: {
                contains: "earthsea",
                mode: "insensitive",
              },
            },
          },
        },
      ],
    };

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 10,
        take: 10,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("uses explicit public relation projections for book lists", async () => {
    const { database, findMany } = createDatabaseMock();
    const service = new CatalogService(database);

    await service.getBooks({
      page: 1,
      pageSize: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: PUBLIC_BOOK_RELATIONS,
      }),
    );
  });

  it("keeps the public price and relation response compatible", async () => {
    const { database, transaction } = createDatabaseMock();
    transaction.mockResolvedValue([
      [
        {
          id: "book-id",
          title: "TypeScript w praktyce",
          slug: "typescript-w-praktyce",
          priceMinor: 7990,
          coverUrl: null,
          description: "Opis",
          publishedAt: new Date("2026-07-17T00:00:00.000Z"),
          author: {
            displayName: "Marcin Kowalski",
            slug: "marcin-kowalski",
          },
          category: {
            name: "Programowanie",
            slug: "programowanie",
          },
        },
      ],
      1,
    ]);
    const service = new CatalogService(database);

    await expect(
      service.getBooks({
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toEqual({
      items: [
        {
          id: "book-id",
          title: "TypeScript w praktyce",
          slug: "typescript-w-praktyce",
          priceCents: 7990,
          coverUrl: null,
          author: {
            name: "Marcin Kowalski",
            slug: "marcin-kowalski",
          },
          category: {
            name: "Programowanie",
            slug: "programowanie",
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("loads details only for a published book", async () => {
    const { database, findFirst } = createDatabaseMock();
    findFirst.mockResolvedValue(null);
    const service = new CatalogService(database);

    await expect(service.getBookBySlug("draft-book")).rejects.toThrow("Book not found.");

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        slug: "draft-book",
        status: "PUBLISHED",
      },
      include: PUBLIC_BOOK_RELATIONS,
    });
  });

  it.each([
    [undefined, [{ createdAt: "desc" }, { id: "asc" }]],
    ["newest", [{ createdAt: "desc" }, { id: "asc" }]],
    ["price-asc", [{ priceMinor: "asc" }, { id: "asc" }]],
    ["price-desc", [{ priceMinor: "desc" }, { id: "asc" }]],
    ["title-asc", [{ title: "asc" }, { id: "asc" }]],
    ["title-desc", [{ title: "desc" }, { id: "asc" }]],
  ] satisfies readonly [CatalogSort | undefined, readonly Record<string, "asc" | "desc">[]][])(
    "maps sort %s to a stable Prisma order",
    async (sort, expectedOrderBy) => {
      const { database, findMany } = createDatabaseMock();
      const service = new CatalogService(database);

      await service.getBooks({
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
  readonly findAuthors: ReturnType<typeof vi.fn>;
  readonly findCategories: ReturnType<typeof vi.fn>;
  readonly findMany: ReturnType<typeof vi.fn>;
  readonly findFirst: ReturnType<typeof vi.fn>;
  readonly count: ReturnType<typeof vi.fn>;
  readonly transaction: ReturnType<typeof vi.fn>;
} {
  const findAuthors = vi.fn().mockResolvedValue([]);
  const findCategories = vi.fn().mockResolvedValue([]);
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const count = vi.fn().mockResolvedValue(0);
  const transaction = vi.fn().mockResolvedValue([[], 0]);

  return {
    database: {
      prisma: {
        author: { findMany: findAuthors },
        category: { findMany: findCategories },
        book: {
          findMany,
          findFirst,
          count,
        },
        $transaction: transaction,
      },
    } as unknown as DatabaseService,
    findAuthors,
    findCategories,
    findMany,
    findFirst,
    count,
    transaction,
  };
}

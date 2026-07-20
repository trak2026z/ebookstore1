import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import { CatalogService } from "./catalog.service";

describe("CatalogService", () => {
  it("filters books by author slug", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const transaction = vi.fn().mockResolvedValue([[], 0]);

    const database = {
      prisma: {
        book: {
          findMany,
          count,
        },
        $transaction: transaction,
      },
    } as unknown as DatabaseService;

    const service = new CatalogService(database);

    await service.getBooks({
      page: 1,
      pageSize: 20,
      author: "ursula-le-guin",
    });

    const expectedWhere = {
      isActive: true,
      author: {
        is: {
          slug: "ursula-le-guin",
        },
      },
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
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("combines author, category and text filters", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const transaction = vi.fn().mockResolvedValue([[], 0]);

    const database = {
      prisma: {
        book: {
          findMany,
          count,
        },
        $transaction: transaction,
      },
    } as unknown as DatabaseService;

    const service = new CatalogService(database);

    await service.getBooks({
      page: 2,
      pageSize: 10,
      category: "science-fiction",
      author: "ursula-le-guin",
      q: "earthsea",
    });

    const expectedWhere = {
      isActive: true,
      category: {
        slug: "science-fiction",
      },
      author: {
        is: {
          slug: "ursula-le-guin",
        },
      },
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
              name: {
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
});

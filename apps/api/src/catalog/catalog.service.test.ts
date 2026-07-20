import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import { CatalogService } from "./catalog.service";

describe("CatalogService", () => {
  it("searches by title or author name without case sensitivity", async () => {
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
      q: "le guin",
    });

    const expectedWhere = {
      isActive: true,
      OR: [
        {
          title: {
            contains: "le guin",
            mode: "insensitive",
          },
        },
        {
          author: {
            is: {
              name: {
                contains: "le guin",
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
        skip: 0,
        take: 20,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("combines text search with the category filter", async () => {
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
      q: "left hand",
    });

    const expectedWhere = {
      isActive: true,
      category: {
        slug: "science-fiction",
      },
      OR: [
        {
          title: {
            contains: "left hand",
            mode: "insensitive",
          },
        },
        {
          author: {
            is: {
              name: {
                contains: "left hand",
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

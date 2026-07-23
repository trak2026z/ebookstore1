import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../database/database.service";
import { CategoriesRepository } from "./categories.repository";

describe("CategoriesRepository", () => {
  it("loads the public projection in stable order", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        name: "Programowanie",
        slug: "programowanie",
      },
    ]);
    const database = {
      prisma: {
        category: {
          findMany,
        },
      },
    } as unknown as DatabaseService;
    const repository = new CategoriesRepository(database);

    await expect(repository.findPublicList()).resolves.toEqual([
      {
        name: "Programowanie",
        slug: "programowanie",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      select: {
        name: true,
        slug: true,
      },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
    });
  });
});

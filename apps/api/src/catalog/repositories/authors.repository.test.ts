import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../database/database.service";
import { AuthorsRepository } from "./authors.repository";

describe("AuthorsRepository", () => {
  it("loads the public projection in stable order", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        displayName: "Anna Nowak",
        slug: "anna-nowak",
      },
    ]);
    const database = {
      prisma: {
        author: {
          findMany,
        },
      },
    } as unknown as DatabaseService;
    const repository = new AuthorsRepository(database);

    await expect(repository.findPublicList()).resolves.toEqual([
      {
        displayName: "Anna Nowak",
        slug: "anna-nowak",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      select: {
        displayName: true,
        slug: true,
      },
      orderBy: [{ displayName: "asc" }, { slug: "asc" }],
    });
  });
});

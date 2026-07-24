import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../database/database.service";
import type { Prisma } from "../../generated/prisma/client.js";
import { BookStatus } from "../../generated/prisma/enums.js";
import type { CatalogSort } from "../catalog-query";

export interface FindPublishedBooksQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort?: CatalogSort;
}

const PUBLIC_BOOK_RELATIONS = {
  authors: {
    select: {
      author: {
        select: {
          displayName: true,
          slug: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { authorId: "asc" }],
    take: 1,
  },
  categories: {
    select: {
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { categoryId: "asc" }],
    take: 1,
  },
} satisfies Prisma.BookInclude;

export type PublicBookRecord = Prisma.BookGetPayload<{
  include: typeof PUBLIC_BOOK_RELATIONS;
}>;

export interface PublishedBooksPage {
  readonly items: readonly PublicBookRecord[];
  readonly total: number;
}

@Injectable()
export class BooksRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  async findPublishedPage(query: FindPublishedBooksQuery): Promise<PublishedBooksPage> {
    const where = buildPublishedBooksWhere(query);

    const [items, total] = await this.database.prisma.$transaction([
      this.database.prisma.book.findMany({
        where,
        include: PUBLIC_BOOK_RELATIONS,
        orderBy: getBookOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.prisma.book.count({ where }),
    ]);

    return {
      items,
      total,
    };
  }

  findPublishedBySlug(slug: string): Promise<PublicBookRecord | null> {
    return this.database.prisma.book.findFirst({
      where: {
        slug,
        status: BookStatus.PUBLISHED,
      },
      include: PUBLIC_BOOK_RELATIONS,
    });
  }
}

function buildPublishedBooksWhere(query: FindPublishedBooksQuery): Prisma.BookWhereInput {
  return {
    status: BookStatus.PUBLISHED,
    ...(query.category === undefined
      ? {}
      : {
          categories: {
            some: {
              category: {
                slug: query.category,
              },
            },
          },
        }),
    ...(query.author === undefined
      ? {}
      : {
          authors: {
            some: {
              author: {
                slug: query.author,
              },
            },
          },
        }),
    ...(query.q === undefined
      ? {}
      : {
          OR: [
            {
              title: {
                contains: query.q,
                mode: "insensitive",
              },
            },
            {
              authors: {
                some: {
                  author: {
                    displayName: {
                      contains: query.q,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          ],
        }),
  };
}

function getBookOrderBy(sort: CatalogSort | undefined): Prisma.BookOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ priceMinor: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ priceMinor: "desc" }, { id: "asc" }];
    case "title-asc":
      return [{ title: "asc" }, { id: "asc" }];
    case "title-desc":
      return [{ title: "desc" }, { id: "asc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "newest":
    case undefined:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import type {
  AuthorListResponse,
  BookDetailsResponse,
  BookListItem,
  BookListResponse,
  CategoryListResponse,
} from "@ebookstore/contracts";

import { DatabaseService } from "../database/database.service";
import type { Prisma } from "../generated/prisma/client.js";
import type { CatalogSort } from "./catalog-query";

interface GetBooksQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort?: CatalogSort;
}

interface BookWithRelations {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly priceMinor: number;
  readonly coverUrl: string | null;
  readonly description: string;
  readonly publishedAt: Date | null;
  readonly authors: readonly {
    readonly author: {
      readonly displayName: string;
      readonly slug: string;
    };
  }[];
  readonly categories: readonly {
    readonly category: {
      readonly name: string;
      readonly slug: string;
    };
  }[];
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  async getAuthors(): Promise<AuthorListResponse> {
    const authors = await this.database.prisma.author.findMany({
      select: {
        displayName: true,
        slug: true,
      },
      orderBy: [{ displayName: "asc" }, { slug: "asc" }],
    });

    return {
      items: authors.map((author) => ({
        name: author.displayName,
        slug: author.slug,
      })),
    };
  }

  async getCategories(): Promise<CategoryListResponse> {
    const categories = await this.database.prisma.category.findMany({
      select: {
        name: true,
        slug: true,
      },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
    });

    return { items: categories };
  }

  async getBooks(query: GetBooksQuery): Promise<BookListResponse> {
    const where = {
      status: "PUBLISHED",
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
    } satisfies Prisma.BookWhereInput;

    const [books, total] = await this.database.prisma.$transaction([
      this.database.prisma.book.findMany({
        where,
        include: getPublicBookRelations(),
        orderBy: getBookOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.prisma.book.count({ where }),
    ]);

    return {
      items: books.map(mapBook),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getBookBySlug(slug: string): Promise<BookDetailsResponse> {
    const book = await this.database.prisma.book.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
      },
      include: getPublicBookRelations(),
    });

    if (book === null) {
      throw new NotFoundException("Book not found.");
    }

    return {
      ...mapBook(book),
      description: book.description,
      publishedAt: book.publishedAt?.toISOString() ?? null,
    };
  }
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

function getPublicBookRelations(): typeof PUBLIC_BOOK_RELATIONS {
  return PUBLIC_BOOK_RELATIONS;
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
    case "newest":
    case undefined:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

function mapBook(book: BookWithRelations): BookListItem {
  const primaryAuthor = book.authors[0]?.author;
  const primaryCategory = book.categories[0]?.category;

  if (primaryAuthor === undefined) {
    throw new InternalServerErrorException("Published book has no author relation.");
  }

  if (primaryCategory === undefined) {
    throw new InternalServerErrorException("Published book has no category relation.");
  }

  return {
    id: book.id,
    title: book.title,
    slug: book.slug,

    // Keep the public v1 response backward compatible while the database
    // adopts the domain-wide `priceMinor` name.
    priceCents: book.priceMinor,
    coverUrl: book.coverUrl,
    author: {
      name: primaryAuthor.displayName,
      slug: primaryAuthor.slug,
    },
    category: {
      name: primaryCategory.name,
      slug: primaryCategory.slug,
    },
  };
}

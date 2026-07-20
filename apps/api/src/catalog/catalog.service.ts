import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { BookDetailsResponse, BookListItem, BookListResponse } from "@ebookstore/contracts";

import { DatabaseService } from "../database/database.service";
import type { Prisma } from "../generated/prisma/client.js";

interface GetBooksQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly q?: string;
}

interface BookWithRelations {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly priceCents: number;
  readonly coverUrl: string | null;
  readonly description: string;
  readonly publishedAt: Date | null;
  readonly author: {
    readonly name: string;
    readonly slug: string;
  };
  readonly category: {
    readonly name: string;
    readonly slug: string;
  };
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  async getBooks(query: GetBooksQuery): Promise<BookListResponse> {
    const where = {
      isActive: true,
      ...(query.category === undefined
        ? {}
        : {
            category: {
              slug: query.category,
            },
          }),
      ...(query.q === undefined
        ? {}
        : {
            title: {
              contains: query.q,
              mode: "insensitive",
            },
          }),
    } satisfies Prisma.BookWhereInput;

    const [books, total] = await this.database.prisma.$transaction([
      this.database.prisma.book.findMany({
        where,
        include: {
          author: true,
          category: true,
        },
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "asc",
          },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.prisma.book.count({
        where,
      }),
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
        isActive: true,
      },
      include: {
        author: true,
        category: true,
      },
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

function mapBook(book: BookWithRelations): BookListItem {
  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    priceCents: book.priceCents,
    coverUrl: book.coverUrl,
    author: book.author,
    category: book.category,
  };
}

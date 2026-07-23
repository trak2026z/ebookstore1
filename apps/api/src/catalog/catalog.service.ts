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

import type { CatalogSort } from "./catalog-query";
import { AuthorsRepository } from "./repositories/authors.repository";
import { BooksRepository, type PublicBookRecord } from "./repositories/books.repository";
import { CategoriesRepository } from "./repositories/categories.repository";

interface GetBooksQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly category?: string;
  readonly author?: string;
  readonly q?: string;
  readonly sort?: CatalogSort;
}

@Injectable()
export class CatalogService {
  constructor(
    @Inject(BooksRepository)
    private readonly booksRepository: BooksRepository,
    @Inject(AuthorsRepository)
    private readonly authorsRepository: AuthorsRepository,
    @Inject(CategoriesRepository)
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async getAuthors(): Promise<AuthorListResponse> {
    const authors = await this.authorsRepository.findPublicList();

    return {
      items: authors.map((author) => ({
        name: author.displayName,
        slug: author.slug,
      })),
    };
  }

  async getCategories(): Promise<CategoryListResponse> {
    const categories = await this.categoriesRepository.findPublicList();

    return {
      items: categories,
    };
  }

  async getBooks(query: GetBooksQuery): Promise<BookListResponse> {
    const page = await this.booksRepository.findPublishedPage(query);

    return {
      items: page.items.map(mapBook),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: page.total,
        totalPages: Math.ceil(page.total / query.pageSize),
      },
    };
  }

  async getBookBySlug(slug: string): Promise<BookDetailsResponse> {
    const book = await this.booksRepository.findPublishedBySlug(slug);

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

function mapBook(book: PublicBookRecord): BookListItem {
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

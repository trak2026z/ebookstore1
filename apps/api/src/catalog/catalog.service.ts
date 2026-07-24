import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type {
  AuthorListResponse,
  CategoryListResponse,
  PublicBookDetailsResponse,
  PublicBookListItem,
  PublicBookListResponse,
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

  async getBooks(query: GetBooksQuery): Promise<PublicBookListResponse> {
    const page = await this.booksRepository.findPublishedPage(query);

    return {
      items: page.items.map(mapPublicBookListItem),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: page.total,
        totalPages: Math.ceil(page.total / query.pageSize),
      },
    };
  }

  async getBookBySlug(slug: string): Promise<PublicBookDetailsResponse> {
    const book = await this.booksRepository.findPublishedBySlug(slug);

    if (book === null) {
      throw new NotFoundException({
        code: "BOOK_NOT_FOUND",
        message: "Book not found.",
      });
    }

    return mapPublicBookDetails(book);
  }
}

function mapPublicBookListItem(book: PublicBookRecord): PublicBookListItem {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    authors: book.authors.map(({ author }) => ({
      id: author.id,
      displayName: author.displayName,
      slug: author.slug,
    })),
    categories: book.categories.map(({ category }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    price: {
      amountMinor: book.priceMinor,
      currency: book.currency,
    },
    format: book.format,
    coverUrl: null,
  };
}

function mapPublicBookDetails(book: PublicBookRecord): PublicBookDetailsResponse {
  return {
    ...mapPublicBookListItem(book),
    isbn: book.isbn,
    description: book.description,
  };
}

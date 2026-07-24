import { describe, expect, it, vi } from "vitest";

import { CatalogService } from "./catalog.service";
import type { AuthorsRepository } from "./repositories/authors.repository";
import type { BooksRepository, PublicBookRecord } from "./repositories/books.repository";
import type { CategoriesRepository } from "./repositories/categories.repository";

describe("CatalogService", () => {
  it("maps authors to the public contract", async () => {
    const { service, findAuthors } = createService();
    findAuthors.mockResolvedValue([
      {
        displayName: "Anna Nowak",
        slug: "anna-nowak",
      },
    ]);

    await expect(service.getAuthors()).resolves.toEqual({
      items: [
        {
          name: "Anna Nowak",
          slug: "anna-nowak",
        },
      ],
    });
  });

  it("returns public categories", async () => {
    const { service, findCategories } = createService();
    findCategories.mockResolvedValue([
      {
        name: "Programowanie",
        slug: "programowanie",
      },
    ]);

    await expect(service.getCategories()).resolves.toEqual({
      items: [
        {
          name: "Programowanie",
          slug: "programowanie",
        },
      ],
    });
  });

  it("maps all public book relations and calculates pagination", async () => {
    const { service, findPublishedPage } = createService();
    findPublishedPage.mockResolvedValue({
      items: [
        {
          ...createBook(),
          coverKey: "private/covers/typescript.epub",
          coverUrl: "https://storage.example/private-cover",
        },
      ],
      total: 21,
    });

    const response = await service.getBooks({
      page: 2,
      pageSize: 10,
      author: "marcin-kowalski",
    });

    expect(response.items[0]).toEqual({
      id: "book-id",
      slug: "typescript-w-praktyce",
      title: "TypeScript w praktyce",
      authors: [
        {
          id: "author-1",
          displayName: "Marcin Kowalski",
          slug: "marcin-kowalski",
        },
        {
          id: "author-2",
          displayName: "Anna Nowak",
          slug: "anna-nowak",
        },
      ],
      categories: [
        {
          id: "category-1",
          name: "Programowanie",
          slug: "programowanie",
        },
        {
          id: "category-2",
          name: "Backend",
          slug: "backend",
        },
      ],
      price: {
        amountMinor: 7990,
        currency: "PLN",
      },
      format: "EPUB",
      coverUrl: null,
    });
    expect(response.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });
    expect(findPublishedPage).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      author: "marcin-kowalski",
    });
  });

  it("returns empty public relation arrays without failing the list", async () => {
    const { service, findPublishedPage } = createService();
    findPublishedPage.mockResolvedValue({
      items: [
        {
          ...createBook(),
          authors: [],
          categories: [],
        },
      ],
      total: 1,
    });

    const response = await service.getBooks({
      page: 1,
      pageSize: 20,
    });

    expect(response.items[0]).toMatchObject({
      authors: [],
      categories: [],
    });
  });

  it("returns published book details through the legacy contract", async () => {
    const { service, findPublishedBySlug } = createService();
    findPublishedBySlug.mockResolvedValue(createBook());

    await expect(service.getBookBySlug("typescript-w-praktyce")).resolves.toEqual({
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
      description: "Opis książki.",
      publishedAt: "2026-07-17T00:00:00.000Z",
    });
  });

  it("throws when a published book does not exist", async () => {
    const { service } = createService();

    await expect(service.getBookBySlug("missing-book")).rejects.toThrow("Book not found.");
  });

  it.each([
    ["authors", "Published book has no author relation."],
    ["categories", "Published book has no category relation."],
  ] as const)("keeps legacy details closed without %s", async (relation, message) => {
    const { service, findPublishedBySlug } = createService();
    findPublishedBySlug.mockResolvedValue({
      ...createBook(),
      [relation]: [],
    });

    await expect(service.getBookBySlug("typescript-w-praktyce")).rejects.toThrow(message);
  });
});

function createService(): {
  readonly service: CatalogService;
  readonly findAuthors: ReturnType<typeof vi.fn>;
  readonly findCategories: ReturnType<typeof vi.fn>;
  readonly findPublishedPage: ReturnType<typeof vi.fn>;
  readonly findPublishedBySlug: ReturnType<typeof vi.fn>;
} {
  const findAuthors = vi.fn().mockResolvedValue([]);
  const findCategories = vi.fn().mockResolvedValue([]);
  const findPublishedPage = vi.fn().mockResolvedValue({
    items: [],
    total: 0,
  });
  const findPublishedBySlug = vi.fn().mockResolvedValue(null);

  const booksRepository = {
    findPublishedPage,
    findPublishedBySlug,
  } as unknown as BooksRepository;
  const authorsRepository = {
    findPublicList: findAuthors,
  } as unknown as AuthorsRepository;
  const categoriesRepository = {
    findPublicList: findCategories,
  } as unknown as CategoriesRepository;

  return {
    service: new CatalogService(booksRepository, authorsRepository, categoriesRepository),
    findAuthors,
    findCategories,
    findPublishedPage,
    findPublishedBySlug,
  };
}

function createBook(): PublicBookRecord {
  return {
    id: "book-id",
    title: "TypeScript w praktyce",
    slug: "typescript-w-praktyce",
    isbn: "9780000000002",
    description: "Opis książki.",
    priceMinor: 7990,
    currency: "PLN",
    status: "PUBLISHED",
    format: "EPUB",
    coverKey: null,
    coverUrl: null,
    publishedAt: new Date("2026-07-17T00:00:00.000Z"),
    createdAt: new Date("2026-07-17T00:00:00.000Z"),
    updatedAt: new Date("2026-07-17T00:00:00.000Z"),
    authors: [
      {
        author: {
          id: "author-1",
          displayName: "Marcin Kowalski",
          slug: "marcin-kowalski",
        },
      },
      {
        author: {
          id: "author-2",
          displayName: "Anna Nowak",
          slug: "anna-nowak",
        },
      },
    ],
    categories: [
      {
        category: {
          id: "category-1",
          name: "Programowanie",
          slug: "programowanie",
        },
      },
      {
        category: {
          id: "category-2",
          name: "Backend",
          slug: "backend",
        },
      },
    ],
  };
}

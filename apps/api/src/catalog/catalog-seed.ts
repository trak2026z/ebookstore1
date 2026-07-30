import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { BookFormat, BookStatus } from "../generated/prisma/enums.js";

interface AuthorSeed {
  readonly slug: string;
  readonly name: string;
  readonly displayName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly biography: string | null;
}

interface CategorySeed {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
}

interface PositionedRelationSeed {
  readonly slug: string;
  readonly position: number;
}

interface BookSeed {
  readonly slug: string;
  readonly title: string;
  readonly isbn: string;
  readonly description: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly status: BookStatus;
  readonly format: BookFormat;
  readonly coverKey: string | null;
  readonly publishedAt: string | null;
  readonly authors: readonly PositionedRelationSeed[];
  readonly categories: readonly PositionedRelationSeed[];
}

interface CatalogSeed {
  readonly authors: readonly AuthorSeed[];
  readonly categories: readonly CategorySeed[];
  readonly books: readonly BookSeed[];
}

export const CATALOG_SEED = {
  authors: [
    {
      slug: "marcin-kowalski",
      name: "Marcin Kowalski",
      displayName: "Marcin Kowalski",
      firstName: "Marcin",
      lastName: "Kowalski",
      biography: "Autor materialow o TypeScript i projektowaniu bezpiecznych aplikacji.",
    },
    {
      slug: "anna-nowak",
      name: "Anna Nowak",
      displayName: "Anna Nowak",
      firstName: "Anna",
      lastName: "Nowak",
      biography: "Architektka oprogramowania specjalizujaca sie w systemach Node.js.",
    },
    {
      slug: "piotr-zielinski",
      name: "Piotr Zielinski",
      displayName: "Piotr Zielinski",
      firstName: "Piotr",
      lastName: "Zielinski",
      biography: "Inzynier bezpieczenstwa aplikacji webowych i interfejsow API.",
    },
  ],
  categories: [
    {
      slug: "programowanie",
      name: "Programowanie",
      description: "E-booki o jezykach programowania i narzedziach developerskich.",
    },
    {
      slug: "architektura-oprogramowania",
      name: "Architektura oprogramowania",
      description: "Projektowanie modularnych, skalowalnych i utrzymywalnych systemow.",
    },
    {
      slug: "bezpieczenstwo",
      name: "Bezpieczenstwo",
      description: "Ochrona aplikacji, danych i interfejsow programistycznych.",
    },
  ],
  books: [
    {
      slug: "typescript-w-praktyce",
      title: "TypeScript w praktyce",
      isbn: "9780000000002",
      description: "Praktyczne wzorce tworzenia bezpiecznych aplikacji TypeScript.",
      priceMinor: 7990,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: "covers/typescript-w-praktyce.epub.jpg",
      publishedAt: "2026-07-17T00:00:00.000Z",
      authors: [
        { slug: "marcin-kowalski", position: 0 },
        { slug: "anna-nowak", position: 1 },
      ],
      categories: [
        { slug: "programowanie", position: 0 },
        {
          slug: "architektura-oprogramowania",
          position: 1,
        },
      ],
    },
    {
      slug: "architektura-aplikacji-node-js",
      title: "Architektura aplikacji Node.js",
      isbn: "9780000000019",
      description: "Modularna architektura, granice odpowiedzialnosci i niezawodne integracje.",
      priceMinor: 8990,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: "covers/architektura-aplikacji-node-js.pdf.jpg",
      publishedAt: "2026-07-20T00:00:00.000Z",
      authors: [
        { slug: "anna-nowak", position: 0 },
        { slug: "piotr-zielinski", position: 1 },
      ],
      categories: [
        {
          slug: "architektura-oprogramowania",
          position: 0,
        },
        { slug: "programowanie", position: 1 },
      ],
    },
    {
      slug: "nowoczesny-javascript",
      title: "Nowoczesny JavaScript",
      isbn: "9780000000040",
      description: "Praktyczne wykorzystanie nowoczesnych funkcji jezyka JavaScript.",
      priceMinor: 5490,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-01T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "testowanie-aplikacji-typescript",
      title: "Testowanie aplikacji TypeScript",
      isbn: "9780000000057",
      description: "Testy jednostkowe, integracyjne i regresyjne dla aplikacji TypeScript.",
      priceMinor: 6490,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-02T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "react-od-podstaw",
      title: "React od podstaw",
      isbn: "9780000000064",
      description: "Komponenty, stan, efekty i nawigacja w aplikacjach React.",
      priceMinor: 5990,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-03T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "wzorce-projektowe-w-typescript",
      title: "Wzorce projektowe w TypeScript",
      isbn: "9780000000071",
      description: "Praktyczne zastosowanie wzorcow projektowych w kodzie TypeScript.",
      priceMinor: 7490,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-04T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "docker-dla-programistow",
      title: "Docker dla programistow",
      isbn: "9780000000088",
      description: "Budowanie powtarzalnych srodowisk developerskich z Docker Compose.",
      priceMinor: 6990,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-05T00:00:00.000Z",
      authors: [{ slug: "piotr-zielinski", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "api-rest-w-praktyce",
      title: "API REST w praktyce",
      isbn: "9780000000095",
      description: "Projektowanie czytelnych i stabilnych interfejsow HTTP.",
      priceMinor: 6790,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-06T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "nestjs-w-produkcji",
      title: "NestJS w produkcji",
      isbn: "9780000000101",
      description: "Konfiguracja, obserwowalnosc i bezpieczne wdrazanie aplikacji NestJS.",
      priceMinor: 8290,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-07T00:00:00.000Z",
      authors: [{ slug: "piotr-zielinski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "postgres-dla-aplikacji-webowych",
      title: "PostgreSQL dla aplikacji webowych",
      isbn: "9780000000118",
      description: "Modelowanie danych, indeksy i transakcje w PostgreSQL.",
      priceMinor: 7790,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-08T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "bezpieczenstwo-jwt",
      title: "Bezpieczenstwo JWT",
      isbn: "9780000000125",
      description: "Bezpieczne uwierzytelnianie i autoryzacja z wykorzystaniem JWT.",
      priceMinor: 6290,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-09T00:00:00.000Z",
      authors: [{ slug: "piotr-zielinski", position: 0 }],
      categories: [{ slug: "bezpieczenstwo", position: 0 }],
    },
    {
      slug: "clean-code-w-javascript",
      title: "Clean Code w JavaScript",
      isbn: "9780000000132",
      description: "Czytelne funkcje, stabilne kontrakty i bezpieczna refaktoryzacja.",
      priceMinor: 5890,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-10T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "architektura-hexagonalna",
      title: "Architektura hexagonalna",
      isbn: "9780000000149",
      description: "Porty, adaptery i separacja logiki biznesowej od infrastruktury.",
      priceMinor: 8590,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-11T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "ci-cd-dla-node-js",
      title: "CI/CD dla Node.js",
      isbn: "9780000000156",
      description: "Automatyczne testowanie, budowanie i publikowanie aplikacji Node.js.",
      priceMinor: 7190,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-12T00:00:00.000Z",
      authors: [{ slug: "piotr-zielinski", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "wydajnosc-aplikacji-react",
      title: "Wydajnosc aplikacji React",
      isbn: "9780000000163",
      description: "Pomiar i ograniczanie kosztow renderowania w aplikacjach React.",
      priceMinor: 7390,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-13T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "projektowanie-api",
      title: "Projektowanie API",
      isbn: "9780000000170",
      description: "Kontrakty, wersjonowanie i obsluga bledow w interfejsach API.",
      priceMinor: 7990,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-14T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "testy-integracyjne-w-node-js",
      title: "Testy integracyjne w Node.js",
      isbn: "9780000000187",
      description: "Weryfikacja wspolpracy API, bazy danych i zaleznosci zewnetrznych.",
      priceMinor: 6890,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-15T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "modelowanie-danych-w-postgresql",
      title: "Modelowanie danych w PostgreSQL",
      isbn: "9780000000194",
      description: "Relacje, ograniczenia i migracje dla niezawodnych baz danych.",
      priceMinor: 7690,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-16T00:00:00.000Z",
      authors: [{ slug: "anna-nowak", position: 0 }],
      categories: [{ slug: "architektura-oprogramowania", position: 0 }],
    },
    {
      slug: "monitoring-aplikacji-node-js",
      title: "Monitoring aplikacji Node.js",
      isbn: "9780000000200",
      description: "Logi, metryki i diagnostyka problemow aplikacji serwerowych.",
      priceMinor: 7490,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2026-07-18T00:00:00.000Z",
      authors: [{ slug: "piotr-zielinski", position: 0 }],
      categories: [{ slug: "bezpieczenstwo", position: 0 }],
    },
    {
      slug: "refaktoryzacja-typescript",
      title: "Refaktoryzacja TypeScript",
      isbn: "9780000000217",
      description: "Male i bezpieczne zmiany kodu chronione testami regresyjnymi.",
      priceMinor: 7290,
      currency: "PLN",
      status: BookStatus.PUBLISHED,
      format: BookFormat.PDF,
      coverKey: null,
      publishedAt: "2026-07-19T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
    {
      slug: "bezpieczne-api-w-nestjs",
      title: "Bezpieczne API w NestJS",
      isbn: "9780000000026",
      description: "Uwierzytelnianie, autoryzacja, walidacja i ochrona danych w NestJS.",
      priceMinor: 6990,
      currency: "PLN",
      status: BookStatus.DRAFT,
      format: BookFormat.PDF,
      coverKey: "covers/bezpieczne-api-w-nestjs.pdf.jpg",
      publishedAt: null,
      authors: [
        { slug: "piotr-zielinski", position: 0 },
        { slug: "marcin-kowalski", position: 1 },
      ],
      categories: [
        { slug: "bezpieczenstwo", position: 0 },
        { slug: "programowanie", position: 1 },
      ],
    },
    {
      slug: "refaktoryzacja-javascript",
      title: "Refaktoryzacja JavaScript",
      isbn: "9780000000033",
      description: "Historyczne wydanie materialu o bezpiecznej modernizacji kodu JavaScript.",
      priceMinor: 5990,
      currency: "PLN",
      status: BookStatus.WITHDRAWN,
      format: BookFormat.EPUB,
      coverKey: null,
      publishedAt: "2025-01-15T00:00:00.000Z",
      authors: [{ slug: "marcin-kowalski", position: 0 }],
      categories: [{ slug: "programowanie", position: 0 }],
    },
  ],
} as const satisfies CatalogSeed;

export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  validateCatalogSeed(CATALOG_SEED);

  await prisma.$transaction(async (transaction) => {
    const authorIds = new Map<string, string>();
    const categoryIds = new Map<string, string>();

    for (const author of CATALOG_SEED.authors) {
      const persistedAuthor = await transaction.author.upsert({
        where: {
          slug: author.slug,
        },
        update: {
          name: author.name,
          displayName: author.displayName,
          firstName: author.firstName,
          lastName: author.lastName,
          biography: author.biography,
        },
        create: author,
        select: {
          id: true,
        },
      });

      authorIds.set(author.slug, persistedAuthor.id);
    }

    for (const category of CATALOG_SEED.categories) {
      const persistedCategory = await transaction.category.upsert({
        where: {
          slug: category.slug,
        },
        update: {
          name: category.name,
          description: category.description,
        },
        create: category,
        select: {
          id: true,
        },
      });

      categoryIds.set(category.slug, persistedCategory.id);
    }

    for (const book of CATALOG_SEED.books) {
      await synchronizeBook(transaction, book, authorIds, categoryIds);
    }
  });
}

export function isValidIsbn13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const digits = Array.from(value, Number);
  const providedCheckDigit = digits.at(-1);

  if (providedCheckDigit === undefined) {
    return false;
  }

  const weightedSum = digits
    .slice(0, 12)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);

  const expectedCheckDigit = (10 - (weightedSum % 10)) % 10;

  return providedCheckDigit === expectedCheckDigit;
}

async function synchronizeBook(
  transaction: Prisma.TransactionClient,
  book: BookSeed,
  authorIds: ReadonlyMap<string, string>,
  categoryIds: ReadonlyMap<string, string>,
): Promise<void> {
  const bookData = {
    slug: book.slug,
    title: book.title,
    isbn: book.isbn,
    description: book.description,
    priceMinor: book.priceMinor,
    currency: book.currency,
    status: book.status,
    format: book.format,
    coverKey: book.coverKey,
    coverUrl: null,
    publishedAt: book.publishedAt === null ? null : new Date(book.publishedAt),
  } satisfies Prisma.BookUncheckedCreateInput;

  const persistedBook = await transaction.book.upsert({
    where: {
      slug: book.slug,
    },
    update: bookData,
    create: bookData,
    select: {
      id: true,
    },
  });

  await transaction.bookAuthor.deleteMany({
    where: {
      bookId: persistedBook.id,
    },
  });

  await transaction.bookCategory.deleteMany({
    where: {
      bookId: persistedBook.id,
    },
  });

  await transaction.bookAuthor.createMany({
    data: book.authors.map((author) => ({
      bookId: persistedBook.id,
      authorId: getRequiredId(authorIds, author.slug, "author"),
      position: author.position,
    })),
  });

  await transaction.bookCategory.createMany({
    data: book.categories.map((category) => ({
      bookId: persistedBook.id,
      categoryId: getRequiredId(categoryIds, category.slug, "category"),
      position: category.position,
    })),
  });
}

function validateCatalogSeed(seed: CatalogSeed): void {
  assertUnique(
    seed.authors.map((author) => author.slug),
    "author slug",
  );
  assertUnique(
    seed.categories.map((category) => category.slug),
    "category slug",
  );
  assertUnique(
    seed.books.map((book) => book.slug),
    "book slug",
  );
  assertUnique(
    seed.books.map((book) => book.isbn),
    "ISBN",
  );

  const authorSlugs = new Set(seed.authors.map((author) => author.slug));
  const categorySlugs = new Set(seed.categories.map((category) => category.slug));

  for (const book of seed.books) {
    if (!isValidIsbn13(book.isbn)) {
      throw new Error(`Catalog seed contains invalid ISBN-13: ${book.isbn}.`);
    }

    if (book.priceMinor < 0) {
      throw new Error(`Catalog seed contains a negative price: ${book.slug}.`);
    }

    if (!/^[A-Z]{3}$/.test(book.currency)) {
      throw new Error(`Catalog seed contains an invalid currency: ${book.currency}.`);
    }

    if (book.status === BookStatus.PUBLISHED && book.publishedAt === null) {
      throw new Error(`Published catalog seed book has no publication date: ${book.slug}.`);
    }

    if (book.status === BookStatus.DRAFT && book.publishedAt !== null) {
      throw new Error(`Draft catalog seed book has a publication date: ${book.slug}.`);
    }

    if (book.authors.length === 0) {
      throw new Error(`Catalog seed book ${book.slug} has no authors.`);
    }

    if (book.categories.length === 0) {
      throw new Error(`Catalog seed book ${book.slug} has no categories.`);
    }

    assertPositions(book.authors, `${book.slug} authors`);
    assertPositions(book.categories, `${book.slug} categories`);

    for (const author of book.authors) {
      if (!authorSlugs.has(author.slug)) {
        throw new Error(`Catalog seed references unknown author: ${author.slug}.`);
      }
    }

    for (const category of book.categories) {
      if (!categorySlugs.has(category.slug)) {
        throw new Error(`Catalog seed references unknown category: ${category.slug}.`);
      }
    }
  }
}

function assertPositions(relations: readonly PositionedRelationSeed[], label: string): void {
  assertUnique(
    relations.map((relation) => relation.slug),
    `${label} relation`,
  );
  assertUnique(
    relations.map((relation) => relation.position),
    `${label} position`,
  );

  for (const relation of relations) {
    if (relation.position < 0) {
      throw new Error(`Catalog seed contains a negative ${label} position.`);
    }
  }
}

function assertUnique(values: readonly (number | string)[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Catalog seed contains a duplicate ${label}.`);
  }
}

function getRequiredId(
  ids: ReadonlyMap<string, string>,
  slug: string,
  entity: "author" | "category",
): string {
  const id = ids.get(slug);

  if (id === undefined) {
    throw new Error(`Catalog seed ${entity} was not persisted: ${slug}.`);
  }

  return id;
}

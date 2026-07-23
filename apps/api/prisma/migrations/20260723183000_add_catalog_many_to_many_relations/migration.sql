-- CreateTable
CREATE TABLE "book_authors" (
    "bookId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_authors_pkey" PRIMARY KEY ("bookId", "authorId")
);

-- CreateTable
CREATE TABLE "book_categories" (
    "bookId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_categories_pkey" PRIMARY KEY ("bookId", "categoryId")
);

-- Backfill the explicit many-to-many relations before removing legacy columns.
INSERT INTO "book_authors" ("bookId", "authorId", "position")
SELECT "id", "authorId", 0
FROM "books";

INSERT INTO "book_categories" ("bookId", "categoryId", "position")
SELECT "id", "categoryId", 0
FROM "books";

-- CreateIndex
CREATE INDEX "book_authors_author_id_book_id_idx"
ON "book_authors"("authorId", "bookId");

-- CreateIndex
CREATE INDEX "book_authors_book_id_position_author_id_idx"
ON "book_authors"("bookId", "position", "authorId");

-- CreateIndex
CREATE INDEX "book_categories_category_id_book_id_idx"
ON "book_categories"("categoryId", "bookId");

-- CreateIndex
CREATE INDEX "book_categories_book_id_position_category_id_idx"
ON "book_categories"("bookId", "position", "categoryId");

-- AddForeignKey
ALTER TABLE "book_authors"
ADD CONSTRAINT "book_authors_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "books"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_authors"
ADD CONSTRAINT "book_authors_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "authors"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_categories"
ADD CONSTRAINT "book_categories_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "books"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_categories"
ADD CONSTRAINT "book_categories_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove indexes and foreign keys that depend on the legacy single relations.
DROP INDEX "books_authorId_idx";
DROP INDEX "books_category_status_idx";
DROP INDEX "books_author_status_created_at_id_idx";

ALTER TABLE "books"
DROP CONSTRAINT "books_authorId_fkey",
DROP CONSTRAINT "books_categoryId_fkey";

ALTER TABLE "books"
DROP COLUMN "authorId",
DROP COLUMN "categoryId";

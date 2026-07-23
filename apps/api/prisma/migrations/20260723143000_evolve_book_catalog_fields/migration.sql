-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "BookFormat" AS ENUM ('PDF', 'EPUB');

-- Preserve the existing monetary values while adopting the domain name.
ALTER TABLE "books"
RENAME COLUMN "priceCents" TO "priceMinor";

-- Add the new catalog fields in a nullable or defaulted form first.
ALTER TABLE "books"
ADD COLUMN "isbn" VARCHAR(40),
ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'PLN',
ADD COLUMN "status" "BookStatus",
ADD COLUMN "format" "BookFormat" NOT NULL DEFAULT 'PDF',
ADD COLUMN "coverKey" VARCHAR(512);

-- Existing books have no ISBN. A deterministic internal value preserves every
-- row and remains unique until an administrator replaces it with a real ISBN.
UPDATE "books"
SET "isbn" = 'legacy-' || replace("id"::text, '-', '');

-- The old model had no draft state. Preserve public availability:
-- active books become published and inactive books become withdrawn.
UPDATE "books"
SET
  "status" = CASE
    WHEN "isActive" THEN 'PUBLISHED'::"BookStatus"
    ELSE 'WITHDRAWN'::"BookStatus"
  END,
  "publishedAt" = CASE
    WHEN "isActive" THEN COALESCE("publishedAt", "createdAt")
    ELSE "publishedAt"
  END;

-- Enforce the target nullability after the backfill.
ALTER TABLE "books"
ALTER COLUMN "isbn" SET NOT NULL,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"BookStatus";

-- Replace indexes that depended on the legacy boolean status.
DROP INDEX "books_categoryId_isActive_idx";
DROP INDEX "books_active_created_at_id_idx";
DROP INDEX "books_author_active_created_at_id_idx";

ALTER TABLE "books"
DROP COLUMN "isActive";

-- CreateIndex
CREATE UNIQUE INDEX "books_isbn_key" ON "books"("isbn");

-- CreateIndex
CREATE INDEX "books_category_status_idx"
ON "books"("categoryId", "status");

-- CreateIndex
CREATE INDEX "books_status_created_at_id_idx"
ON "books"("status", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "books_author_status_created_at_id_idx"
ON "books"("authorId", "status", "createdAt" DESC, "id");

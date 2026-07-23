-- Add the new author fields in a backward-compatible form.
ALTER TABLE "authors"
ADD COLUMN "displayName" VARCHAR(160),
ADD COLUMN "firstName" VARCHAR(80),
ADD COLUMN "lastName" VARCHAR(100),
ADD COLUMN "biography" TEXT;

-- Preserve every existing author name before enforcing NOT NULL.
UPDATE "authors"
SET "displayName" = "name";

ALTER TABLE "authors"
ALTER COLUMN "displayName" SET NOT NULL;

-- Add optional category metadata.
ALTER TABLE "categories"
ADD COLUMN "description" TEXT;

-- Support stable public author ordering and future administrative searches.
CREATE INDEX "authors_display_name_idx"
ON "authors"("displayName");

-- Add constraints as NOT VALID first. This keeps the strongest table lock
-- short, then validates existing rows with a less restrictive lock.

ALTER TABLE "books"
ADD CONSTRAINT "books_price_minor_non_negative_check"
CHECK ("priceMinor" >= 0) NOT VALID;

ALTER TABLE "books"
VALIDATE CONSTRAINT "books_price_minor_non_negative_check";

ALTER TABLE "books"
ADD CONSTRAINT "books_currency_iso_4217_check"
CHECK ("currency" ~ '^[A-Z]{3}$') NOT VALID;

ALTER TABLE "books"
VALIDATE CONSTRAINT "books_currency_iso_4217_check";

ALTER TABLE "book_authors"
ADD CONSTRAINT "book_authors_position_non_negative_check"
CHECK ("position" >= 0) NOT VALID;

ALTER TABLE "book_authors"
VALIDATE CONSTRAINT "book_authors_position_non_negative_check";

ALTER TABLE "book_categories"
ADD CONSTRAINT "book_categories_position_non_negative_check"
CHECK ("position" >= 0) NOT VALID;

ALTER TABLE "book_categories"
VALIDATE CONSTRAINT "book_categories_position_non_negative_check";

-- Support deterministic title ordering and future administrative title lookup.
CREATE INDEX "books_title_idx"
ON "books"("title");

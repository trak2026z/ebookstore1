-- CreateIndex
CREATE INDEX "authors_name_idx" ON "authors"("name");

-- CreateIndex
CREATE INDEX "books_active_created_at_id_idx" ON "books"("isActive", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "books_author_active_created_at_id_idx" ON "books"("authorId", "isActive", "createdAt" DESC, "id");

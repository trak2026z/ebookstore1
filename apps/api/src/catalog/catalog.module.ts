import { Module } from "@nestjs/common";

import { AuthorsController } from "./authors.controller";
import { BookCoverController } from "./book-cover.controller";
import { BookCoverService } from "./book-cover.service";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CategoriesController } from "./categories.controller";
import { CoverStorageService } from "./cover-storage.service";
import { AuthorsRepository } from "./repositories/authors.repository";
import { BooksRepository } from "./repositories/books.repository";
import { CategoriesRepository } from "./repositories/categories.repository";

@Module({
  controllers: [CatalogController, BookCoverController, AuthorsController, CategoriesController],
  providers: [
    CatalogService,
    BookCoverService,
    CoverStorageService,
    BooksRepository,
    AuthorsRepository,
    CategoriesRepository,
  ],
})
export class CatalogModule {}

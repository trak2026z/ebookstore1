import { Module } from "@nestjs/common";

import { AuthorsController } from "./authors.controller";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CategoriesController } from "./categories.controller";
import { AuthorsRepository } from "./repositories/authors.repository";
import { BooksRepository } from "./repositories/books.repository";
import { CategoriesRepository } from "./repositories/categories.repository";

@Module({
  controllers: [CatalogController, AuthorsController, CategoriesController],
  providers: [CatalogService, BooksRepository, AuthorsRepository, CategoriesRepository],
})
export class CatalogModule {}

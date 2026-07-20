import { Module } from "@nestjs/common";

import { AuthorsController } from "./authors.controller";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({
  controllers: [CatalogController, AuthorsController],
  providers: [CatalogService],
})
export class CatalogModule {}

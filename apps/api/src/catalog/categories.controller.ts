import { Controller, Get, Inject } from "@nestjs/common";

import type { CategoryListResponse } from "@ebookstore/contracts";

import { CatalogService } from "./catalog.service";

@Controller("categories")
export class CategoriesController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  getCategories(): Promise<CategoryListResponse> {
    return this.catalog.getCategories();
  }
}

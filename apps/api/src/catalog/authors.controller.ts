import { Controller, Get, Inject } from "@nestjs/common";

import type { AuthorListResponse } from "@ebookstore/contracts";

import { CatalogService } from "./catalog.service";

@Controller("authors")
export class AuthorsController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  getAuthors(): Promise<AuthorListResponse> {
    return this.catalog.getAuthors();
  }
}

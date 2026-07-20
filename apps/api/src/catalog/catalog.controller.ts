import { BadRequestException, Controller, Get, Inject, Param, Query } from "@nestjs/common";

import type { BookDetailsResponse, BookListResponse } from "@ebookstore/contracts";

import { parseCatalogQuery } from "./catalog-query";
import { CatalogService } from "./catalog.service";

@Controller("books")
export class CatalogController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  getBooks(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("category") category?: string,
    @Query("q") q?: string,
  ): Promise<BookListResponse> {
    try {
      const query = parseCatalogQuery({
        ...(page === undefined ? {} : { page }),
        ...(pageSize === undefined ? {} : { pageSize }),
        ...(category === undefined ? {} : { category }),
        ...(q === undefined ? {} : { q }),
      });

      return this.catalog.getBooks({
        page: query.page,
        pageSize: query.pageSize,
        ...(query.category === undefined ? {} : { category: query.category }),
        ...(query.q === undefined ? {} : { q: query.q }),
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Get(":slug")
  getBook(@Param("slug") slug: string): Promise<BookDetailsResponse> {
    return this.catalog.getBookBySlug(slug);
  }
}

import { BadRequestException, Controller, Get, Inject, Param, Query } from "@nestjs/common";

import type { BookDetailsResponse, BookListResponse } from "@ebookstore/contracts";

import { CatalogService } from "./catalog.service";

@Controller("books")
export class CatalogController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  getBooks(
    @Query("page") pageInput?: string,
    @Query("pageSize") pageSizeInput?: string,
    @Query("category") category?: string,
  ): Promise<BookListResponse> {
    return this.catalog.getBooks({
      page: parsePositiveInteger(pageInput, 1, "page"),
      pageSize: parsePositiveInteger(pageSizeInput, 20, "pageSize", 100),
      ...(category === undefined ? {} : { category }),
    });
  }

  @Get(":slug")
  getBook(@Param("slug") slug: string): Promise<BookDetailsResponse> {
    return this.catalog.getBookBySlug(slug);
  }
}

function parsePositiveInteger(
  input: string | undefined,
  fallback: number,
  field: string,
  maximum?: number,
): number {
  if (input === undefined) {
    return fallback;
  }

  const value = Number(input);

  if (!Number.isInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

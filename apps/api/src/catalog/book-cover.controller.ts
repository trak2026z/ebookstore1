import { Controller, Get, Inject, Param, ParseUUIDPipe, StreamableFile } from "@nestjs/common";

import { BookCoverService } from "./book-cover.service";

@Controller("books")
export class BookCoverController {
  constructor(
    @Inject(BookCoverService)
    private readonly bookCovers: BookCoverService,
  ) {}

  @Get(":bookId/cover")
  async getCover(
    @Param("bookId", new ParseUUIDPipe({ version: "4" }))
    bookId: string,
  ): Promise<StreamableFile> {
    const cover = await this.bookCovers.getCover(bookId);

    return new StreamableFile(cover.stream, {
      type: cover.contentType,
      length: cover.contentLength,
    });
  }
}

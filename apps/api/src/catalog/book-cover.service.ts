import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CoverStorageService, type CoverFile } from "./cover-storage.service";
import { BooksRepository } from "./repositories/books.repository";

const BOOK_COVER_NOT_FOUND = {
  code: "BOOK_COVER_NOT_FOUND",
  message: "Book cover not found.",
} as const;

@Injectable()
export class BookCoverService {
  constructor(
    @Inject(BooksRepository)
    private readonly booksRepository: BooksRepository,
    @Inject(CoverStorageService)
    private readonly coverStorage: CoverStorageService,
  ) {}

  async getCover(bookId: string): Promise<CoverFile> {
    const book = await this.booksRepository.findPublishedCoverById(bookId);

    if (book === null || book.coverKey === null) {
      throw createBookCoverNotFound();
    }

    let cover: CoverFile | null;

    try {
      cover = await this.coverStorage.openCover(book.coverKey);
    } catch {
      throw createBookCoverNotFound();
    }

    if (cover === null) {
      throw createBookCoverNotFound();
    }

    return cover;
  }
}

function createBookCoverNotFound(): NotFoundException {
  return new NotFoundException(BOOK_COVER_NOT_FOUND);
}

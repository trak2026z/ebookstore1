import { NotFoundException } from "@nestjs/common";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { BookCoverService } from "./book-cover.service";
import type { CoverFile, CoverStorageService } from "./cover-storage.service";
import type { BooksRepository } from "./repositories/books.repository";

describe("BookCoverService", () => {
  it("returns a cover for a published book", async () => {
    const { service, findPublishedCoverById, openCover } = createService();
    const cover = createCover();

    findPublishedCoverById.mockResolvedValue({
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      coverKey: "covers/typescript.jpg",
    });
    openCover.mockResolvedValue(cover);

    await expect(service.getCover("8ac42a9c-b736-4575-b7a9-b72f1168ad29")).resolves.toBe(cover);
    expect(findPublishedCoverById).toHaveBeenCalledWith("8ac42a9c-b736-4575-b7a9-b72f1168ad29");
    expect(openCover).toHaveBeenCalledWith("covers/typescript.jpg");
  });

  it("returns BOOK_COVER_NOT_FOUND when the book is not public", async () => {
    const { service } = createService();

    await expectBookCoverNotFound(service.getCover("8ac42a9c-b736-4575-b7a9-b72f1168ad29"));
  });

  it("returns BOOK_COVER_NOT_FOUND when the book has no cover key", async () => {
    const { service, findPublishedCoverById, openCover } = createService();

    findPublishedCoverById.mockResolvedValue({
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      coverKey: null,
    });

    await expectBookCoverNotFound(service.getCover("8ac42a9c-b736-4575-b7a9-b72f1168ad29"));
    expect(openCover).not.toHaveBeenCalled();
  });

  it("returns BOOK_COVER_NOT_FOUND when storage cannot open the file", async () => {
    const { service, findPublishedCoverById, openCover } = createService();

    findPublishedCoverById.mockResolvedValue({
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      coverKey: "covers/missing.jpg",
    });
    openCover.mockResolvedValue(null);

    await expectBookCoverNotFound(service.getCover("8ac42a9c-b736-4575-b7a9-b72f1168ad29"));
  });

  it("does not expose storage failures", async () => {
    const { service, findPublishedCoverById, openCover } = createService();

    findPublishedCoverById.mockResolvedValue({
      id: "8ac42a9c-b736-4575-b7a9-b72f1168ad29",
      coverKey: "covers/private.jpg",
    });
    openCover.mockRejectedValue(new Error("/workspace/storage/covers/private.jpg: EACCES"));

    await expectBookCoverNotFound(service.getCover("8ac42a9c-b736-4575-b7a9-b72f1168ad29"));
  });
});

function createService(): {
  readonly service: BookCoverService;
  readonly findPublishedCoverById: ReturnType<typeof vi.fn>;
  readonly openCover: ReturnType<typeof vi.fn>;
} {
  const findPublishedCoverById = vi.fn().mockResolvedValue(null);
  const openCover = vi.fn().mockResolvedValue(null);

  const booksRepository = {
    findPublishedCoverById,
  } as unknown as BooksRepository;
  const coverStorage = {
    openCover,
  } as unknown as CoverStorageService;

  return {
    service: new BookCoverService(booksRepository, coverStorage),
    findPublishedCoverById,
    openCover,
  };
}

function createCover(): CoverFile {
  const content = Buffer.from("cover");

  return {
    stream: Readable.from(content),
    contentType: "image/jpeg",
    contentLength: content.length,
  };
}

async function expectBookCoverNotFound(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error("Expected getCover to reject.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(NotFoundException);

    if (!(error instanceof NotFoundException)) {
      return;
    }

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({
      code: "BOOK_COVER_NOT_FOUND",
      message: "Book cover not found.",
    });
  }
}

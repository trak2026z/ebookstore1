import { NotFoundException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Readable } from "node:stream";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureApp } from "../platform/configure-app";
import { BookCoverController } from "./book-cover.controller";
import { BookCoverService } from "./book-cover.service";

const BOOK_ID = "8ac42a9c-b736-4575-b7a9-b72f1168ad29";

describe("BookCoverController", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("streams a public cover with content headers", async () => {
    const content = Buffer.from("image-content");
    const getCover = vi.fn().mockResolvedValue({
      stream: Readable.from(content),
      contentType: "image/jpeg",
      contentLength: content.length,
    });
    app = await createApp(getCover);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/books/${BOOK_ID}/cover`)
      .expect(200);

    expect(response.headers["content-type"]).toMatch(/^image\/jpeg/);
    expect(response.headers["content-length"]).toBe(String(content.length));
    expect(Buffer.from(response.body)).toEqual(content);
    expect(getCover).toHaveBeenCalledWith(BOOK_ID);
  });

  it("rejects an invalid UUID before calling the service", async () => {
    const getCover = vi.fn();
    app = await createApp(getCover);

    const response = await request(app.getHttpServer())
      .get("/api/v1/books/not-a-uuid/cover")
      .expect(400);

    expect(response.body).toMatchObject({
      code: "VALIDATION_ERROR",
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(getCover).not.toHaveBeenCalled();
  });

  it("returns a safe BOOK_COVER_NOT_FOUND response", async () => {
    const getCover = vi.fn().mockRejectedValue(
      new NotFoundException({
        code: "BOOK_COVER_NOT_FOUND",
        message: "Book cover not found.",
      }),
    );
    app = await createApp(getCover);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/books/${BOOK_ID}/cover`)
      .expect(404);

    expect(response.body).toEqual({
      code: "BOOK_COVER_NOT_FOUND",
      message: "Book cover not found.",
      requestId: expect.any(String),
      details: [],
    });
    expect(JSON.stringify(response.body)).not.toContain("coverKey");
    expect(JSON.stringify(response.body)).not.toContain("/workspace/storage");
  });
});

async function createApp(getCover: ReturnType<typeof vi.fn>): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [BookCoverController],
    providers: [
      {
        provide: BookCoverService,
        useValue: { getCover },
      },
    ],
  }).compile();

  const application = module.createNestApplication();
  configureApp(application);
  await application.init();

  return application;
}

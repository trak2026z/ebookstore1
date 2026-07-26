import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AppConfig } from "../config/app-config";
import { CoverStorageService } from "./cover-storage.service";

describe("CoverStorageService", () => {
  let storageRoot: string;
  const cleanupPaths: string[] = [];

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "ebookstore-covers-"));
    cleanupPaths.push(storageRoot);
    await mkdir(join(storageRoot, "covers"), { recursive: true });
  });

  afterEach(async () => {
    await Promise.all(
      cleanupPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })),
    );
  });

  it("streams a JPEG file with safe public metadata", async () => {
    const content = Buffer.from("jpeg-content");
    await writeFile(join(storageRoot, "covers", "book.jpg"), content);

    const cover = await createStorage().openCover("covers/book.jpg");

    expect(cover).not.toBeNull();

    if (cover === null) {
      return;
    }

    expect(cover.contentType).toBe("image/jpeg");
    expect(cover.contentLength).toBe(content.length);
    await expect(readStream(cover.stream)).resolves.toEqual(content);
  });

  it.each([
    ["book.jpeg", "image/jpeg"],
    ["book.png", "image/png"],
    ["book.webp", "image/webp"],
  ])("supports %s as %s", async (fileName, contentType) => {
    const content = Buffer.from(fileName);
    await writeFile(join(storageRoot, "covers", fileName), content);

    const cover = await createStorage().openCover(`covers/${fileName}`);

    expect(cover?.contentType).toBe(contentType);
    expect(cover?.contentLength).toBe(content.length);

    if (cover !== null) {
      await expect(readStream(cover.stream)).resolves.toEqual(content);
    }
  });

  it("returns null for missing files and directories", async () => {
    await mkdir(join(storageRoot, "covers", "directory.jpg"));

    await expect(createStorage().openCover("covers/missing.jpg")).resolves.toBeNull();
    await expect(createStorage().openCover("covers/directory.jpg")).resolves.toBeNull();
  });

  it.each([
    "../secret.jpg",
    "/tmp/secret.jpg",
    "covers\\secret.jpg",
    "covers/../secret.jpg",
    "covers/./secret.jpg",
    "covers//secret.jpg",
    "covers/secret.gif",
    "covers/\0secret.jpg",
  ])("rejects unsafe or unsupported key %j", async (key) => {
    await expect(createStorage().openCover(key)).resolves.toBeNull();
  });

  it("rejects a symlink that resolves outside the storage root", async () => {
    const externalRoot = await mkdtemp(join(tmpdir(), "ebookstore-external-cover-"));
    cleanupPaths.push(externalRoot);

    const externalFile = join(externalRoot, "secret.jpg");
    await writeFile(externalFile, "secret");
    await symlink(externalFile, join(storageRoot, "covers", "linked.jpg"));

    await expect(createStorage().openCover("covers/linked.jpg")).resolves.toBeNull();
  });

  function createStorage(): CoverStorageService {
    const config: AppConfig = {
      nodeEnv: "test",
      port: 3001,
      databaseUrl: "postgresql://ebookstore:ebookstore_dev@postgres:5432/ebookstore",
      coverStorageRoot: storageRoot,
    };

    return new CoverStorageService(config);
  }
});

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

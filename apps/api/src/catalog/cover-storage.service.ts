import { Inject, Injectable } from "@nestjs/common";
import { open, realpath, type FileHandle } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import type { Readable } from "node:stream";

import { APP_CONFIG, type AppConfig } from "../config/app-config";

const CONTENT_TYPES = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export interface CoverFile {
  readonly stream: Readable;
  readonly contentType: string;
  readonly contentLength: number;
}

@Injectable()
export class CoverStorageService {
  private readonly storageRoot: string;

  constructor(
    @Inject(APP_CONFIG)
    config: AppConfig,
  ) {
    this.storageRoot = config.coverStorageRoot;
  }

  async openCover(key: string): Promise<CoverFile | null> {
    const contentType = this.resolveContentType(key);

    if (contentType === null || !this.isSafeKey(key)) {
      return null;
    }

    let fileHandle: FileHandle | undefined;

    try {
      const rootRealPath = await realpath(this.storageRoot);
      const candidatePath = resolve(this.storageRoot, key);

      if (!isPathInside(this.storageRoot, candidatePath)) {
        return null;
      }

      const candidateRealPath = await realpath(candidatePath);

      if (!isPathInside(rootRealPath, candidateRealPath)) {
        return null;
      }

      fileHandle = await open(candidateRealPath, "r");
      const stats = await fileHandle.stat();

      if (!stats.isFile()) {
        await fileHandle.close();
        return null;
      }

      const stream = fileHandle.createReadStream({
        autoClose: true,
      });
      fileHandle = undefined;

      return {
        stream,
        contentType,
        contentLength: stats.size,
      };
    } catch {
      await fileHandle?.close().catch(() => undefined);
      return null;
    }
  }

  private isSafeKey(key: string): boolean {
    if (key.length === 0 || key.includes("\0") || key.includes("\\") || isAbsolute(key)) {
      return false;
    }

    const segments = key.split("/");

    return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
  }

  private resolveContentType(key: string): string | null {
    return CONTENT_TYPES.get(extname(key).toLowerCase()) ?? null;
  }
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath);

  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

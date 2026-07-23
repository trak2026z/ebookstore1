import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../database/database.service";

export interface PublicAuthorRecord {
  readonly displayName: string;
  readonly slug: string;
}

@Injectable()
export class AuthorsRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  findPublicList(): Promise<readonly PublicAuthorRecord[]> {
    return this.database.prisma.author.findMany({
      select: {
        displayName: true,
        slug: true,
      },
      orderBy: [{ displayName: "asc" }, { slug: "asc" }],
    });
  }
}

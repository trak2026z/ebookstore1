import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../database/database.service";

export interface PublicCategoryRecord {
  readonly name: string;
  readonly slug: string;
}

@Injectable()
export class CategoriesRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  findPublicList(): Promise<readonly PublicCategoryRecord[]> {
    return this.database.prisma.category.findMany({
      select: {
        name: true,
        slug: true,
      },
      orderBy: [{ name: "asc" }, { slug: "asc" }],
    });
  }
}

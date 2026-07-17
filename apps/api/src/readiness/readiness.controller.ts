import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import type { ReadinessResponse } from "@ebookstore/contracts";

import { DatabaseService } from "../database/database.service";

@Controller("ready")
export class ReadinessController {
  constructor(
    @Inject(DatabaseService)
    private readonly database: DatabaseService,
  ) {}

  @Get()
  async getReadiness(): Promise<ReadinessResponse> {
    try {
      await this.database.ping();

      return {
        status: "ready",
        checks: {
          database: "ok",
        },
      };
    } catch {
      throw new ServiceUnavailableException("Database is unavailable.");
    }
  }
}

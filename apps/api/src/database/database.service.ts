import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";

import { APP_CONFIG, type AppConfig } from "../config/app-config";
import type { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private client: PrismaClient | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    const [{ PrismaPg }, { PrismaClient }] = await Promise.all([
      import("@prisma/adapter-pg"),
      import("../generated/prisma/client.js"),
    ]);

    const adapter = new PrismaPg({
      connectionString: this.config.databaseUrl,
    });

    this.client = new PrismaClient({ adapter });
    await this.client.$connect();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client !== null) {
      await this.client.$disconnect();
      this.client = null;
    }
  }

  async ping(): Promise<void> {
    // The query is a constant controlled by the application, not user input.
    await this.getClient().$queryRawUnsafe("SELECT 1");
  }

  get prisma(): PrismaClient {
    return this.getClient();
  }

  private getClient(): PrismaClient {
    if (this.client === null) {
      throw new Error("Database client is not initialized.");
    }

    return this.client;
  }
}

import { Module } from "@nestjs/common";

import { AdminUsersModule } from "./admin-users/admin-users.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { ReadinessModule } from "./readiness/readiness.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    ReadinessModule,
    CatalogModule,
    AuthModule,
    AdminUsersModule,
  ],
})
export class AppModule {}

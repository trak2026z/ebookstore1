import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { APP_CONFIG, type AppConfig } from "./config/app-config";
import { configureApp } from "./platform/configure-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(config.port, "0.0.0.0");

  const logger = new Logger("Bootstrap");
  logger.log(`API listening on port ${config.port}`);
}

void bootstrap();

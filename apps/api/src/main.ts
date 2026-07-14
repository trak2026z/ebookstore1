import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { configureApp } from "./platform/configure-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const portValue = process.env["PORT"] ?? "3001";
  const port = Number.parseInt(portValue, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${portValue}`);
  }

  await app.listen(port, "0.0.0.0");

  const logger = new Logger("Bootstrap");
  logger.log(`API listening on port ${port}`);
}

void bootstrap();

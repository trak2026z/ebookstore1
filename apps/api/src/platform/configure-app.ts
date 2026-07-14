import { ValidationPipe, type INestApplication } from "@nestjs/common";

import { ApiExceptionFilter } from "./http/api-exception.filter";
import { requestIdMiddleware } from "./http/request-id.middleware";

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api/v1");
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}

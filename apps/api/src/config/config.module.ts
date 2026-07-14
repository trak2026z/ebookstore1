import { Global, Module } from "@nestjs/common";

import { APP_CONFIG } from "./app-config";
import { parseEnvironment } from "./parse-environment";

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => parseEnvironment(process.env),
    },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}

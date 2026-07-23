import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { parseJwtConfig } from "./jwt-config";
import { PasswordService } from "./password.service";
import { RolesGuard } from "./roles.guard";

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const jwtConfig = parseJwtConfig(process.env);

        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.accessTokenTtlSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PasswordService, RolesGuard],
  exports: [JwtModule, UsersModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}

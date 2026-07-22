import {
  Body,
  Controller,
  HttpCode,
  Get,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from "./dto/login.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from "./dto/register.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { LoginResponse } from "./login-response";
import type { UserResponse } from "./user-response";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<UserResponse> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserResponse): UserResponse {
    return user;
  }
}

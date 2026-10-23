import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedUser } from './authenticated-user';
import {
  AuthService,
  AuthSessionResponse,
  AuthTokenResponse,
} from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-communityos-client') client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    this.assertBrowserRequest(client);
    return this.sendSession(await this.authService.register(dto), response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Headers('x-communityos-client') client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    this.assertBrowserRequest(client);
    return this.sendSession(await this.authService.login(dto), response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Headers('x-communityos-client') client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokenResponse> {
    this.assertBrowserRequest(client);
    const token = this.readRefreshToken(request);
    return this.sendSession(await this.authService.refresh(token), response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Headers('x-communityos-client') client: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertBrowserRequest(client);
    await this.authService.revokeSession(this.readRefreshToken(request, false));
    response.setHeader('Set-Cookie', this.sessionCookie('', true));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private sendSession(
    session: AuthSessionResponse,
    response: Response,
  ): AuthTokenResponse {
    response.setHeader('Set-Cookie', this.sessionCookie(session.refreshToken));
    return {
      accessToken: session.accessToken,
      tokenType: session.tokenType,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  }

  private readRefreshToken(request: Request, required = true): string {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('communityos_session='));
    const token = cookie?.slice('communityos_session='.length);
    if (!token && required) {
      throw new ForbiddenException('A login session cookie is required');
    }
    return token ?? '';
  }

  private sessionCookie(token: string, clear = false): string {
    const attributes = [
      `communityos_session=${token}`,
      'Path=/auth',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${clear ? 0 : 400 * 24 * 60 * 60}`,
    ];
    if (process.env.NODE_ENV === 'production') {
      attributes.push('Secure');
    }
    return attributes.join('; ');
  }

  private assertBrowserRequest(client: string | undefined): void {
    if (client !== 'communityos-web') {
      throw new ForbiddenException('A trusted browser request is required');
    }
  }
}

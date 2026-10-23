import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './authenticated-user';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_HASH_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;
const SESSION_TOKEN_BYTES = 32;

export interface AuthSessionResponse extends AuthTokenResponse {
  refreshToken: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException('Password must not exceed 72 UTF-8 bytes');
    }

    const email = dto.email.trim().toLowerCase();
    const fullName = dto.fullName.trim();

    if (!fullName) {
      throw new BadRequestException('Full name must not be empty');
    }

    const passwordHash = await hash(dto.password, PASSWORD_HASH_ROUNDS);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email, fullName, passwordHash },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }

    return this.createSessionResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthSessionResponse> {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    return this.createSessionResponse(user);
  }

  async refresh(refreshToken: string): Promise<AuthSessionResponse> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
      throw new UnauthorizedException('The login session is invalid');
    }

    const tokenHash = this.hashSessionToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('The login session is invalid');
    }

    return this.createTokenResponse(session.user, refreshToken);
  }

  async revokeSession(refreshToken?: string): Promise<void> {
    if (!refreshToken || !/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) {
      return;
    }

    await this.prisma.authSession.deleteMany({
      where: { tokenHash: this.hashSessionToken(refreshToken) },
    });
  }

  private async createSessionResponse(
    user: User,
  ): Promise<AuthSessionResponse> {
    const refreshToken = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashSessionToken(refreshToken),
      },
    });

    return this.createTokenResponse(user, refreshToken);
  }

  private async createTokenResponse(
    user: User,
    refreshToken: string,
  ): Promise<AuthSessionResponse> {
    const authenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    };

    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: authenticatedUser,
      refreshToken,
    };
  }

  private hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

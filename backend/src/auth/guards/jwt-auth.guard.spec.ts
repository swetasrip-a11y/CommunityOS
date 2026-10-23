import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const user: User = {
    id: 'd87c2ff3-9910-4a62-b43d-7ef1674d0215',
    email: 'resident@example.com',
    passwordHash: 'password-hash',
    phone: null,
    fullName: 'Resident User',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const request: { headers: { authorization?: string }; user?: typeof user } = {
    headers: {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const prisma = {
    user: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    delete request.user;
    guard = new JwtAuthGuard(jwtService, prisma);
  });

  it('requires a bearer access token', async () => {
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid and expired tokens without hiding unrelated errors', async () => {
    request.headers.authorization = 'Bearer invalid-token';
    jest
      .mocked(jwtService.verifyAsync)
      .mockRejectedValueOnce(
        Object.assign(new Error('expired'), { name: 'TokenExpiredError' }),
      );
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    jest
      .mocked(jwtService.verifyAsync)
      .mockRejectedValueOnce(new Error('database issue'));
    await expect(guard.canActivate(context)).rejects.toThrow('database issue');
  });

  it('loads the account from the database for a verified token', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jest.mocked(jwtService.verifyAsync).mockResolvedValue({ sub: user.id });
    jest.mocked(prisma.user.findUnique).mockResolvedValue(user);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: { id: true, email: true, fullName: true },
    });
    expect(request.user).toMatchObject({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });
  });

  it('rejects a valid token after its account has been removed', async () => {
    request.headers.authorization = 'Bearer valid-token';
    jest.mocked(jwtService.verifyAsync).mockResolvedValue({ sub: user.id });
    jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

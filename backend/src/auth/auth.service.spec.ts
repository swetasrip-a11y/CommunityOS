import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const existingUser: User = {
    id: 'd87c2ff3-9910-4a62-b43d-7ef1674d0215',
    email: 'resident@example.com',
    passwordHash: '',
    phone: null,
    fullName: 'Resident User',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const createUser = jest.fn<Promise<User>, [Prisma.UserCreateArgs]>();
  const findUser = jest.fn<Promise<User | null>, [Prisma.UserFindUniqueArgs]>();
  const createSession = jest.fn();
  const findSession = jest.fn();
  const deleteSession = jest.fn();
  const prisma = {
    user: {
      create: createUser,
      findUnique: findUser,
    },
    authSession: {
      create: createSession,
      findUnique: findSession,
      deleteMany: deleteSession,
    },
  } as unknown as PrismaService;
  const signToken = jest.fn<Promise<string>, [object]>();
  const jwtService = {
    signAsync: signToken,
  } as unknown as JwtService;
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(prisma, jwtService);
    signToken.mockResolvedValue('signed-access-token');
    createSession.mockResolvedValue({});
    deleteSession.mockResolvedValue({ count: 1 });
  });

  it('registers with a normalized email and a one-way password hash', async () => {
    const user = { ...existingUser };
    createUser.mockImplementation(async ({ data }) => {
      user.email = data.email;
      user.fullName = data.fullName;
      user.passwordHash = data.passwordHash;
      return user;
    });

    const result = await authService.register({
      email: ' Resident@Example.com ',
      fullName: ' Resident User ',
      password: 'a-long-test-password',
    });

    expect(createUser).toHaveBeenCalledTimes(1);
    const createArgs = createUser.mock.calls[0][0];
    expect(createArgs.data.email).toBe('resident@example.com');
    expect(createArgs.data.fullName).toBe('Resident User');
    expect(createArgs.data.passwordHash).not.toBe('a-long-test-password');
    await expect(
      compare('a-long-test-password', createArgs.data.passwordHash),
    ).resolves.toBe(true);
    expect(result).toMatchObject({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: existingUser.id,
        email: 'resident@example.com',
        fullName: 'Resident User',
      },
    });
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createSession).toHaveBeenCalledWith({
      data: {
        userId: existingUser.id,
        tokenHash: expect.any(String),
      },
    });
    expect(result).not.toHaveProperty('user.passwordHash');
    expect(signToken).toHaveBeenCalledWith({ sub: existingUser.id });
  });

  it('rejects duplicate emails with a conflict response', async () => {
    createUser.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      authService.register({
        email: 'resident@example.com',
        fullName: 'Resident User',
        password: 'a-long-test-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects passwords exceeding bcrypt UTF-8 input limits', async () => {
    await expect(
      authService.register({
        email: 'resident@example.com',
        fullName: 'Resident User',
        password: 'é'.repeat(37),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects overlong UTF-8 login passwords without looking up an account', async () => {
    await expect(
      authService.login({
        email: 'resident@example.com',
        password: 'é'.repeat(37),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUser).not.toHaveBeenCalled();
  });

  it('returns the same unauthorized response for unknown email and wrong password', async () => {
    findUser.mockResolvedValue(null);
    await expect(
      authService.login({
        email: 'unknown@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const passwordHash = await hash('correct-test-password', 4);
    findUser.mockResolvedValue({
      ...existingUser,
      passwordHash,
    });
    await expect(
      authService.login({
        email: 'resident@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues a token after verifying the stored password hash', async () => {
    const passwordHash = await hash('correct-test-password', 4);
    findUser.mockResolvedValue({
      ...existingUser,
      passwordHash,
    });

    const result = await authService.login({
      email: 'RESIDENT@example.com',
      password: 'correct-test-password',
    });
    expect(result).toMatchObject({
      accessToken: 'signed-access-token',
      user: { id: existingUser.id, email: existingUser.email },
    });
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(findUser).toHaveBeenCalledWith({
      where: { email: existingUser.email },
    });
  });

  it('renews access tokens from a valid persistent session', async () => {
    findSession.mockResolvedValue({
      id: 'session-id',
      user: existingUser,
    });

    const refreshToken = 'a'.repeat(43);
    const result = await authService.refresh(refreshToken);

    expect(findSession).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      include: { user: true },
    });
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toBe(refreshToken);
    await expect(authService.refresh('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes the refresh session on logout', async () => {
    const token = 'b'.repeat(43);
    await authService.revokeSession(token);

    expect(deleteSession).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
    });
  });
});

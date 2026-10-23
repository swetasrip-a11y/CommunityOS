import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  const users = new Map<string, User>();
  const sessions = new Map<string, { tokenHash: string; user: User }>();
  const createUser = jest.fn<Promise<User>, [Prisma.UserCreateArgs]>();
  const findUser = jest.fn<Promise<User | null>, [Prisma.UserFindUniqueArgs]>();
  const createSession = jest.fn();
  const findSession = jest.fn();
  const deleteSession = jest.fn();
  const prisma = {
    user: { create: createUser, findUnique: findUser },
    authSession: {
      create: createSession,
      findUnique: findSession,
      deleteMany: deleteSession,
    },
    communityMembership: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  let app: INestApplication;

  beforeAll(async () => {
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'test-secret-for-communityos-e2e-suite-only';
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    users.clear();
    sessions.clear();
    jest.clearAllMocks();
    createUser.mockImplementation(async ({ data }) => {
      const now = new Date();
      const user: User = {
        id: randomUUID(),
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone ?? null,
        fullName: data.fullName,
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      return user;
    });
    findUser.mockImplementation(async ({ where }) => {
      if (where.id) {
        return users.get(where.id) ?? null;
      }
      if (where.email) {
        return (
          [...users.values()].find((user) => user.email === where.email) ?? null
        );
      }
      return null;
    });
    createSession.mockImplementation(async ({ data }) => {
      const user = users.get(data.userId);
      if (!user) throw new Error('Test session user was not found');
      const session = { tokenHash: data.tokenHash, user };
      sessions.set(data.tokenHash, session);
      return session;
    });
    findSession.mockImplementation(async ({ where }) => {
      return sessions.get(where.tokenHash) ?? null;
    });
    deleteSession.mockImplementation(async ({ where }) => ({
      count: sessions.delete(where.tokenHash) ? 1 : 0,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, and returns the authenticated account without its password hash', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-CommunityOS-Client', 'communityos-web')
      .send({
        email: 'resident@example.com',
        fullName: 'Resident User',
        password: 'a-long-test-password',
      })
      .expect(201);

    expect(registered.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { email: 'resident@example.com', fullName: 'Resident User' },
    });
    expect(registered.body.accessToken).toEqual(expect.any(String));
    expect(registered.body.user).not.toHaveProperty('passwordHash');
    expect(registered.headers['set-cookie'][0]).toMatch(
      /communityos_session=.*HttpOnly; SameSite=Strict/,
    );

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-CommunityOS-Client', 'communityos-web')
      .send({
        email: 'RESIDENT@example.com',
        password: 'a-long-test-password',
      })
      .expect(200);
    const sessionCookie = login.headers['set-cookie']?.[0]?.split(';')[0];
    if (!sessionCookie) {
      throw new Error('Login did not return its session cookie');
    }

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-CommunityOS-Client', 'communityos-web')
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body).not.toHaveProperty('refreshToken');

    const currentUser = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(currentUser.body).toEqual({
      id: registered.body.user.id,
      email: 'resident@example.com',
      fullName: 'Resident User',
    });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-CommunityOS-Client', 'communityos-web')
      .set('Cookie', sessionCookie)
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('X-CommunityOS-Client', 'communityos-web')
      .set('Cookie', sessionCookie)
      .expect(401);
  });

  it('rejects invalid registration input and requests without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('X-CommunityOS-Client', 'communityos-web')
      .send({
        email: 'not-an-email',
        fullName: 'Resident User',
        password: 'short',
        unexpected: true,
      })
      .expect(400);

    await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(createUser).not.toHaveBeenCalled();
  });
});

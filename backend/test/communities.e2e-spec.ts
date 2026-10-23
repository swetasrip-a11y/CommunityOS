import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommunityRole, MembershipStatus, Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Communities (e2e)', () => {
  const community = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Maple Grove',
    slug: 'maple-grove-a1b2c3d4e5f60718',
  };
  const securityTargetMembershipId = '55555555-5555-4555-8555-555555555555';
  const membership = { id: 'membership-id' };
  const createCommunity = jest.fn();
  const createMembership = jest.fn();
  const createRole = jest.fn();
  const createManyRoles = jest.fn();
  const deleteManyRoles = jest.fn();
  const findRoles = jest.fn();
  const findMemberships = jest.fn();
  const findMembership = jest.fn();
  const findCommunity = jest.fn();
  const findUnit = jest.fn();
  const createBlock = jest.fn();
  const createUnit = jest.fn();
  const findInvitations = jest.fn();
  const findInvitation = jest.fn();
  const createInvitation = jest.fn();
  const updateInvitationMany = jest.fn();
  const createMembershipUnit = jest.fn();
  const transactionClient = {
    community: { create: createCommunity },
    communityMembership: { create: createMembership },
    communityMembershipRole: {
      create: createRole,
      createMany: createManyRoles,
      deleteMany: deleteManyRoles,
      findMany: findRoles,
    },
    communityInvitation: { updateMany: updateInvitationMany },
    communityMembershipUnit: { create: createMembershipUnit },
  };
  const prisma = {
    $transaction: jest.fn(
      (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(transactionClient as unknown as Prisma.TransactionClient),
    ),
    communityMembership: {
      findMany: findMemberships,
      findFirst: findMembership,
    },
    communityMembershipRole: {
      createMany: createManyRoles,
      deleteMany: deleteManyRoles,
      findMany: findRoles,
    },
    community: { findUnique: findCommunity },
    communityInvitation: {
      findMany: findInvitations,
      findUnique: findInvitation,
      findFirst: findInvitation,
      create: createInvitation,
      updateMany: updateInvitationMany,
    },
    unit: { findFirst: findUnit, create: createUnit },
    block: { create: createBlock },
  } as unknown as PrismaService;
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'test-secret-for-communityos-e2e-suite-only';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            id: 'creator-user-id',
            email: 'creator@example.test',
            fullName: 'Community Creator',
          };
          return true;
        },
      })
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
    jest.clearAllMocks();
    createCommunity.mockResolvedValue(community);
    createMembership.mockResolvedValue(membership);
    createRole.mockResolvedValue({});
    createManyRoles.mockResolvedValue({ count: 1 });
    deleteManyRoles.mockResolvedValue({ count: 1 });
    findRoles.mockResolvedValue([{ role: CommunityRole.RESIDENT }]);
    createMembershipUnit.mockResolvedValue({});
    findMemberships.mockResolvedValue([]);
    findMembership.mockResolvedValue({
      id: membership.id,
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    findCommunity.mockResolvedValue({ ...community, blocks: [] });
    createBlock.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Tower A',
      code: 'A',
      units: [],
    });
    createUnit.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      number: '204',
      floor: 2,
    });
    findUnit.mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' });
    findInvitations.mockResolvedValue([]);
    findInvitation.mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      communityId: community.id,
      unitId: '33333333-3333-4333-8333-333333333333',
    });
    createInvitation.mockImplementation(
      ({ data }: { data: { expiresAt: Date } }) =>
        Promise.resolve({
          id: '44444444-4444-4444-8444-444444444444',
          expiresAt: data.expiresAt,
        }),
    );
    updateInvitationMany.mockResolvedValue({ count: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a community and establishes its creator as initial administrator', async () => {
    await request(app.getHttpServer())
      .post('/communities')
      .send({ name: 'Maple Grove' })
      .expect(201)
      .expect({
        membershipId: membership.id,
        community,
        roles: [CommunityRole.ADMINISTRATOR],
      });

    expect(createCommunity).toHaveBeenCalledWith({
      data: { name: 'Maple Grove', slug: expect.any(String) },
      select: { id: true, name: true, slug: true },
    });
    expect(createMembership).toHaveBeenCalledWith({
      data: {
        communityId: community.id,
        userId: 'creator-user-id',
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(createRole).toHaveBeenCalledWith({
      data: {
        communityId: community.id,
        membershipId: membership.id,
        role: CommunityRole.ADMINISTRATOR,
      },
    });
  });

  it('returns only the signed-in user’s active community memberships', async () => {
    findMemberships.mockResolvedValue([
      {
        id: membership.id,
        community,
        roles: [{ role: CommunityRole.ADMINISTRATOR }],
      },
    ]);

    await request(app.getHttpServer())
      .get('/communities/mine')
      .expect(200)
      .expect([
        {
          membershipId: membership.id,
          community,
          roles: [CommunityRole.ADMINISTRATOR],
        },
      ]);

    expect(findMemberships).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'creator-user-id', status: MembershipStatus.ACTIVE },
      }),
    );
  });

  it('lets administrators list active members and grant or remove the security role', async () => {
    findMemberships.mockResolvedValue([
      {
        id: securityTargetMembershipId,
        user: { fullName: 'Taylor Resident', email: 'taylor@example.test' },
        roles: [{ role: CommunityRole.RESIDENT }],
      },
    ]);
    await request(app.getHttpServer())
      .get(`/communities/${community.id}/members`)
      .expect(200)
      .expect([
        {
          membershipId: securityTargetMembershipId,
          fullName: 'Taylor Resident',
          email: 'taylor@example.test',
          roles: [CommunityRole.RESIDENT],
        },
      ]);

    findMembership.mockImplementation(({ select }) =>
      select.user
        ? {
            id: securityTargetMembershipId,
            user: { fullName: 'Taylor Resident', email: 'taylor@example.test' },
          }
        : {
            id: membership.id,
            roles: [{ role: CommunityRole.ADMINISTRATOR }],
          },
    );
    findRoles.mockResolvedValue([
      { role: CommunityRole.RESIDENT },
      { role: CommunityRole.SECURITY_GUARD },
    ]);
    await request(app.getHttpServer())
      .patch(
        `/communities/${community.id}/members/${securityTargetMembershipId}/security-role`,
      )
      .send({ enabled: true })
      .expect(200)
      .expect({
        membershipId: securityTargetMembershipId,
        fullName: 'Taylor Resident',
        email: 'taylor@example.test',
        roles: [CommunityRole.RESIDENT, CommunityRole.SECURITY_GUARD],
      });
    expect(createManyRoles).toHaveBeenCalledWith({
      data: [
        {
          communityId: community.id,
          membershipId: securityTargetMembershipId,
          role: CommunityRole.SECURITY_GUARD,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('prevents residents from listing members or changing security roles', async () => {
    findMembership.mockResolvedValue({
      id: securityTargetMembershipId,
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    await request(app.getHttpServer())
      .get(`/communities/${community.id}/members`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(
        `/communities/${community.id}/members/${securityTargetMembershipId}/security-role`,
      )
      .send({ enabled: true })
      .expect(403);
    expect(createManyRoles).not.toHaveBeenCalled();
  });

  it('rejects attempts to choose an administrator role in the request', async () => {
    await request(app.getHttpServer())
      .post('/communities')
      .send({ name: 'Maple Grove', role: 'ADMINISTRATOR' })
      .expect(400);

    expect(createCommunity).not.toHaveBeenCalled();
  });

  it('returns the community structure to active members without exposing apartment numbers', async () => {
    findCommunity.mockResolvedValue({
      ...community,
      blocks: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Tower A',
          code: 'A',
          units: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              number: '204',
              floor: 2,
            },
          ],
        },
      ],
    });

    await request(app.getHttpServer())
      .get(`/communities/${community.id}/structure`)
      .expect(200)
      .expect({
        ...community,
        blocks: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Tower A',
            code: 'A',
            units: [
              {
                id: '33333333-3333-4333-8333-333333333333',
                number: '204',
                floor: 2,
              },
            ],
          },
        ],
      });

    findMembership.mockResolvedValue({
      id: membership.id,
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    await request(app.getHttpServer())
      .get(`/communities/${community.id}/structure`)
      .expect(200)
      .expect((response) => {
        expect(response.body.blocks[0].units).toEqual([]);
      });
  });

  it('allows active administrators to create blocks and apartments', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${community.id}/blocks`)
      .send({ name: 'Tower A', code: 'a' })
      .expect(201)
      .expect({
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Tower A',
        code: 'A',
        units: [],
      });

    expect(createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { communityId: community.id, name: 'Tower A', code: 'A' },
      }),
    );

    await request(app.getHttpServer())
      .post(
        `/communities/${community.id}/blocks/22222222-2222-4222-8222-222222222222/units`,
      )
      .send({ number: '204', floor: 2 })
      .expect(201)
      .expect({
        id: '33333333-3333-4333-8333-333333333333',
        number: '204',
        floor: 2,
      });

    expect(createUnit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          communityId: community.id,
          blockId: '22222222-2222-4222-8222-222222222222',
          number: '204',
          floor: 2,
        },
      }),
    );
  });

  it('rejects block creation for members without the administrator role', async () => {
    findMembership.mockResolvedValue({
      id: membership.id,
      roles: [{ role: CommunityRole.RESIDENT }],
    });

    await request(app.getHttpServer())
      .post(`/communities/${community.id}/blocks`)
      .send({ name: 'Tower A', code: 'A' })
      .expect(403);

    expect(createBlock).not.toHaveBeenCalled();
  });

  it('validates block and apartment inputs', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${community.id}/blocks`)
      .send({ name: 'Tower A', code: 'A', unexpected: true })
      .expect(400);
    await request(app.getHttpServer())
      .post(
        `/communities/${community.id}/blocks/22222222-2222-4222-8222-222222222222/units`,
      )
      .send({ number: '204', floor: 301 })
      .expect(400);

    expect(createBlock).not.toHaveBeenCalled();
    expect(createUnit).not.toHaveBeenCalled();
  });

  it('creates apartment-specific invitation codes for administrators', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${community.id}/invitations`)
      .send({ unitId: '33333333-3333-4333-8333-333333333333' })
      .expect(201)
      .expect((response) => {
        expect(response.body.id).toBe('44444444-4444-4444-8444-444444444444');
        expect(response.body.code).toMatch(/^([A-F0-9]{4}-){7}[A-F0-9]{4}$/);
        expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(
          Date.now(),
        );
      });

    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: community.id,
          unitId: '33333333-3333-4333-8333-333333333333',
          createdByUserId: 'creator-user-id',
          codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it('redeems an invitation into an active resident apartment membership', async () => {
    const member = {
      id: 'new-membership-id',
      community: {
        id: community.id,
        name: community.name,
        slug: community.slug,
      },
    };
    createMembership.mockResolvedValue(member);

    await request(app.getHttpServer())
      .post('/communities/invitations/redeem')
      .send({ code: 'A1B2-C3D4-E5F6-7890-A1B2-C3D4-E5F6-7890' })
      .expect(201)
      .expect({
        membershipId: member.id,
        community: member.community,
        roles: [CommunityRole.RESIDENT],
      });

    expect(createRole).toHaveBeenCalledWith({
      data: {
        communityId: community.id,
        membershipId: member.id,
        role: CommunityRole.RESIDENT,
      },
    });
    expect(createMembershipUnit).toHaveBeenCalledWith({
      data: {
        communityId: community.id,
        membershipId: member.id,
        unitId: '33333333-3333-4333-8333-333333333333',
        occupancy: 'OCCUPANT',
      },
    });
  });

  it('rejects invitations for apartments outside the community', async () => {
    findUnit.mockResolvedValue(null);

    await request(app.getHttpServer())
      .post(`/communities/${community.id}/invitations`)
      .send({ unitId: '33333333-3333-4333-8333-333333333333' })
      .expect(404);

    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('lists invitation status and revokes an unused code for administrators', async () => {
    const invitation = {
      id: '44444444-4444-4444-8444-444444444444',
      unit: {
        id: '33333333-3333-4333-8333-333333333333',
        number: '204',
        block: { name: 'Tower A', code: 'A' },
      },
      createdAt: new Date('2026-10-18T10:00:00Z'),
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
      revokedAt: null,
    };
    findInvitations.mockResolvedValue([invitation]);

    await request(app.getHttpServer())
      .get(`/communities/${community.id}/invitations`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          {
            ...invitation,
            createdAt: invitation.createdAt.toISOString(),
            expiresAt: invitation.expiresAt.toISOString(),
            status: 'ACTIVE',
          },
        ]);
      });

    await request(app.getHttpServer())
      .delete(
        `/communities/${community.id}/invitations/44444444-4444-4444-8444-444444444444`,
      )
      .expect(200)
      .expect({ revoked: true });
    expect(updateInvitationMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: '44444444-4444-4444-8444-444444444444',
          communityId: community.id,
        }),
      }),
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommunityRole, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommunitiesService } from './communities.service';

describe('CommunitiesService', () => {
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
  const runTransaction = jest.fn(
    (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(transactionClient as unknown as Prisma.TransactionClient),
  );
  const prisma = {
    $transaction: runTransaction,
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
  let service: CommunitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommunitiesService(prisma);
    createCommunity.mockResolvedValue({
      id: 'community-id',
      name: 'Maple Grove',
      slug: 'maple-grove-a1b2c3d4',
    });
    createMembership.mockResolvedValue({ id: 'membership-id' });
    createRole.mockResolvedValue({});
    createManyRoles.mockResolvedValue({ count: 1 });
    deleteManyRoles.mockResolvedValue({ count: 1 });
    findRoles.mockResolvedValue([{ role: CommunityRole.RESIDENT }]);
    createMembershipUnit.mockResolvedValue({});
    findMembership.mockResolvedValue({
      id: 'membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    findCommunity.mockResolvedValue({
      id: 'community-id',
      name: 'Maple Grove',
      slug: 'maple-grove',
      blocks: [],
    });
    createBlock.mockResolvedValue({
      id: 'block-id',
      name: 'Tower A',
      code: 'A',
      units: [],
    });
    createUnit.mockResolvedValue({ id: 'unit-id', number: '204', floor: 2 });
    findUnit.mockResolvedValue({ id: 'unit-id' });
    createInvitation.mockImplementation(
      ({ data }: { data: { expiresAt: Date } }) =>
        Promise.resolve({ id: 'invitation-id', expiresAt: data.expiresAt }),
    );
    findInvitations.mockResolvedValue([]);
    findInvitation.mockResolvedValue({
      id: 'invitation-id',
      communityId: 'community-id',
      unitId: 'unit-id',
    });
    updateInvitationMany.mockResolvedValue({ count: 1 });
  });

  it('creates a community and grants its creator the initial administrator role', async () => {
    const result = await service.createForOwner('user-id', {
      name: ' Maple Grove ',
    });

    expect(createCommunity).toHaveBeenCalledWith({
      data: {
        name: 'Maple Grove',
        slug: expect.stringMatching(/^maple-grove-[a-f0-9]{16}$/),
      },
      select: { id: true, name: true, slug: true },
    });
    expect(createMembership).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        userId: 'user-id',
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
    expect(createRole).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        membershipId: 'membership-id',
        role: CommunityRole.ADMINISTRATOR,
      },
    });
    expect(result.roles).toEqual([CommunityRole.ADMINISTRATOR]);
    expect(runTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a blank community name without writing to the database', async () => {
    await expect(
      service.createForOwner('user-id', { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('lists only active memberships and their community roles', async () => {
    findMemberships.mockResolvedValue([
      {
        id: 'membership-id',
        community: {
          id: 'community-id',
          name: 'Maple Grove',
          slug: 'maple-grove',
        },
        roles: [{ role: CommunityRole.ADMINISTRATOR }],
      },
    ]);

    await expect(service.listForUser('user-id')).resolves.toEqual([
      {
        membershipId: 'membership-id',
        community: {
          id: 'community-id',
          name: 'Maple Grove',
          slug: 'maple-grove',
        },
        roles: [CommunityRole.ADMINISTRATOR],
      },
    ]);
    expect(findMemberships).toHaveBeenCalledWith({
      where: { userId: 'user-id', status: MembershipStatus.ACTIVE },
      include: {
        community: { select: { id: true, name: true, slug: true } },
        roles: { select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('lists community members and their roles for administrators only', async () => {
    findMemberships.mockResolvedValue([
      {
        id: 'resident-membership-id',
        user: { fullName: 'Taylor Resident', email: 'taylor@example.test' },
        roles: [
          { role: CommunityRole.RESIDENT },
          { role: CommunityRole.SECURITY_GUARD },
        ],
      },
    ]);

    await expect(
      service.listCommunityMembers('admin-user-id', 'community-id'),
    ).resolves.toEqual([
      {
        membershipId: 'resident-membership-id',
        fullName: 'Taylor Resident',
        email: 'taylor@example.test',
        roles: [CommunityRole.RESIDENT, CommunityRole.SECURITY_GUARD],
      },
    ]);
    expect(findMemberships).toHaveBeenCalledWith({
      where: { communityId: 'community-id', status: MembershipStatus.ACTIVE },
      select: {
        id: true,
        user: { select: { fullName: true, email: true } },
        roles: { select: { role: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    findMembership.mockResolvedValue({
      id: 'resident-membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    await expect(
      service.listCommunityMembers('resident-user-id', 'community-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('adds and removes only the security role for an active community member', async () => {
    findMembership.mockImplementation(({ select }) =>
      select.user
        ? {
            id: 'resident-membership-id',
            user: { fullName: 'Taylor Resident', email: 'taylor@example.test' },
          }
        : {
            id: 'admin-membership-id',
            roles: [{ role: CommunityRole.ADMINISTRATOR }],
          },
    );
    findRoles.mockResolvedValue([
      { role: CommunityRole.RESIDENT },
      { role: CommunityRole.SECURITY_GUARD },
    ]);

    await expect(
      service.setSecurityRole(
        'admin-user-id',
        'community-id',
        'resident-membership-id',
        true,
      ),
    ).resolves.toMatchObject({
      membershipId: 'resident-membership-id',
      roles: [CommunityRole.RESIDENT, CommunityRole.SECURITY_GUARD],
    });
    expect(createManyRoles).toHaveBeenCalledWith({
      data: [
        {
          communityId: 'community-id',
          membershipId: 'resident-membership-id',
          role: CommunityRole.SECURITY_GUARD,
        },
      ],
      skipDuplicates: true,
    });
    expect(deleteManyRoles).not.toHaveBeenCalled();

    await service.setSecurityRole(
      'admin-user-id',
      'community-id',
      'resident-membership-id',
      false,
    );
    expect(deleteManyRoles).toHaveBeenCalledWith({
      where: {
        communityId: 'community-id',
        membershipId: 'resident-membership-id',
        role: CommunityRole.SECURITY_GUARD,
      },
    });
  });

  it('rejects assigning security role to an inactive or other-community member', async () => {
    findMembership.mockImplementation(({ select }) =>
      select.user
        ? null
        : {
            id: 'admin-membership-id',
            roles: [{ role: CommunityRole.ADMINISTRATOR }],
          },
    );

    await expect(
      service.setSecurityRole(
        'admin-user-id',
        'community-id',
        'outsider-membership-id',
        true,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(createManyRoles).not.toHaveBeenCalled();
  });

  it('returns apartment numbers only to an active community administrator', async () => {
    findCommunity.mockResolvedValue({
      id: 'community-id',
      name: 'Maple Grove',
      slug: 'maple-grove',
      blocks: [
        {
          id: 'block-id',
          name: 'Tower A',
          code: 'A',
          units: [{ id: 'unit-id', number: '204', floor: 2 }],
        },
      ],
    });

    await expect(
      service.getStructure('admin-user-id', 'community-id'),
    ).resolves.toMatchObject({
      blocks: [{ units: [{ id: 'unit-id', number: '204', floor: 2 }] }],
    });
    expect(findMembership).toHaveBeenCalledWith({
      where: {
        userId: 'admin-user-id',
        communityId: 'community-id',
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true, roles: { select: { role: true } } },
    });

    findMembership.mockResolvedValue({
      id: 'resident-membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    await expect(
      service.getStructure('resident-user-id', 'community-id'),
    ).resolves.toMatchObject({ blocks: [{ units: [] }] });
  });

  it('requires an active community membership to view its structure', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      service.getStructure('unrelated-user-id', 'community-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findCommunity).not.toHaveBeenCalled();
  });

  it('creates a normalized block only for an active administrator', async () => {
    await expect(
      service.createBlock('admin-user-id', 'community-id', {
        name: ' Tower A ',
        code: ' a ',
      }),
    ).resolves.toEqual({
      id: 'block-id',
      name: 'Tower A',
      code: 'A',
      units: [],
    });
    expect(createBlock).toHaveBeenCalledWith({
      data: { communityId: 'community-id', name: 'Tower A', code: 'A' },
      select: {
        id: true,
        name: true,
        code: true,
        units: {
          select: { id: true, number: true, floor: true },
          orderBy: { number: 'asc' },
        },
      },
    });

    findMembership.mockResolvedValue({
      id: 'resident-membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    await expect(
      service.createBlock('resident-user-id', 'community-id', {
        name: 'Tower B',
        code: 'B',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createBlock).toHaveBeenCalledTimes(1);
  });

  it('creates apartments with optional floors and rejects duplicate entries', async () => {
    await expect(
      service.createUnit('admin-user-id', 'community-id', 'block-id', {
        number: ' 204 ',
        floor: 2,
      }),
    ).resolves.toEqual({ id: 'unit-id', number: '204', floor: 2 });
    expect(createUnit).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        blockId: 'block-id',
        number: '204',
        floor: 2,
      },
      select: { id: true, number: true, floor: true },
    });

    createUnit.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate apartment', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.createUnit('admin-user-id', 'community-id', 'block-id', {
        number: '204',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a single-use invitation tied to an apartment and stores only its hash', async () => {
    const before = Date.now();
    const result = await service.createInvitation(
      'admin-user-id',
      'community-id',
      { unitId: 'unit-id' },
    );

    expect(result.code).toMatch(/^([A-F0-9]{4}-){7}[A-F0-9]{4}$/);
    expect(result.id).toBe('invitation-id');
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 7 * 24 * 60 * 60 * 1000,
    );
    expect(createInvitation).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        unitId: 'unit-id',
        createdByUserId: 'admin-user-id',
        codeHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      },
      select: { id: true, expiresAt: true },
    });
    expect(createInvitation.mock.calls[0][0].data.codeHash).not.toContain(
      result.code.replace(/-/g, ''),
    );
  });

  it('does not create invitations for an apartment in another community', async () => {
    findUnit.mockResolvedValue(null);

    await expect(
      service.createInvitation('admin-user-id', 'community-id', {
        unitId: 'foreign-unit-id',
      }),
    ).rejects.toThrow('Apartment not found in this community');
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('lists invitation statuses without returning code hashes', async () => {
    findInvitations.mockResolvedValue([
      {
        id: 'invitation-id',
        unit: {
          id: 'unit-id',
          number: '204',
          block: { name: 'Tower A', code: 'A' },
        },
        createdAt: new Date('2026-10-18T10:00:00Z'),
        expiresAt: new Date(Date.now() + 60_000),
        redeemedAt: null,
        revokedAt: null,
      },
    ]);

    await expect(
      service.listInvitations('admin-user-id', 'community-id'),
    ).resolves.toMatchObject([{ id: 'invitation-id', status: 'ACTIVE' }]);
    expect(findInvitations.mock.calls[0][0].select).not.toHaveProperty(
      'codeHash',
    );
  });

  it('revokes an unused invitation within its community', async () => {
    await expect(
      service.revokeInvitation(
        'admin-user-id',
        'community-id',
        'invitation-id',
      ),
    ).resolves.toEqual({ revoked: true });
    expect(updateInvitationMany).toHaveBeenCalledWith({
      where: {
        id: 'invitation-id',
        communityId: 'community-id',
        redeemedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('redeems an invitation atomically and grants only resident access to its apartment', async () => {
    createMembership.mockResolvedValue({
      id: 'new-membership-id',
      community: {
        id: 'community-id',
        name: 'Maple Grove',
        slug: 'maple-grove',
      },
    });

    await expect(
      service.redeemInvitation('new-user-id', {
        code: 'a1b2-c3d4-e5f6-7890-a1b2-c3d4-e5f6-7890',
      }),
    ).resolves.toEqual({
      membershipId: 'new-membership-id',
      community: {
        id: 'community-id',
        name: 'Maple Grove',
        slug: 'maple-grove',
      },
      roles: [CommunityRole.RESIDENT],
    });
    expect(updateInvitationMany).toHaveBeenCalledWith({
      where: {
        id: 'invitation-id',
        redeemedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        redeemedAt: expect.any(Date),
        redeemedByUserId: 'new-user-id',
      },
    });
    expect(createMembership).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        userId: 'new-user-id',
        status: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
        community: { select: { id: true, name: true, slug: true } },
      },
    });
    expect(createRole).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        membershipId: 'new-membership-id',
        role: CommunityRole.RESIDENT,
      },
    });
    expect(createMembershipUnit).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        membershipId: 'new-membership-id',
        unitId: 'unit-id',
        occupancy: 'OCCUPANT',
      },
    });
  });

  it('rejects malformed and already claimed invitation codes', async () => {
    await expect(
      service.redeemInvitation('new-user-id', { code: 'not-a-code' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findInvitation).not.toHaveBeenCalled();

    updateInvitationMany.mockResolvedValue({ count: 0 });
    await expect(
      service.redeemInvitation('new-user-id', {
        code: 'A1B2-C3D4-E5F6-7890-A1B2-C3D4-E5F6-7890',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CommunityRole, MembershipStatus } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { COMMUNITY_ROLES_KEY } from '../auth.constants';
import { CommunityRolesGuard } from './community-roles.guard';

describe('CommunityRolesGuard', () => {
  const request = {
    params: { communityId: 'd87c2ff3-9910-4a62-b43d-7ef1674d0215' },
    user: {
      id: 'e554b514-3d4b-4946-81cb-6110482a3e1d',
      email: 'admin@example.com',
      fullName: 'Admin',
    },
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const prisma = {
    communityMembership: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  let guard: CommunityRolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    request.params.communityId = 'd87c2ff3-9910-4a62-b43d-7ef1674d0215';
    request.user = {
      id: 'e554b514-3d4b-4946-81cb-6110482a3e1d',
      email: 'admin@example.com',
      fullName: 'Admin',
    };
    guard = new CommunityRolesGuard(reflector, prisma);
  });

  it('allows access only when an active membership has a required role', async () => {
    jest
      .mocked(reflector.getAllAndOverride)
      .mockReturnValue([CommunityRole.ADMINISTRATOR]);
    jest
      .mocked(prisma.communityMembership.findFirst)
      .mockResolvedValue({ id: 'membership-id' } as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.communityMembership.findFirst).toHaveBeenCalledWith({
      where: {
        communityId: request.params.communityId,
        userId: request.user.id,
        status: MembershipStatus.ACTIVE,
        roles: { some: { role: { in: [CommunityRole.ADMINISTRATOR] } } },
      },
      select: { id: true },
    });
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      COMMUNITY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
  });

  it('denies users without an active membership and matching role', async () => {
    jest
      .mocked(reflector.getAllAndOverride)
      .mockReturnValue([CommunityRole.ADMINISTRATOR]);
    jest.mocked(prisma.communityMembership.findFirst).mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects missing or invalid community route identifiers', async () => {
    jest
      .mocked(reflector.getAllAndOverride)
      .mockReturnValue([CommunityRole.ADMINISTRATOR]);
    request.params.communityId = 'not-a-uuid';

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.communityMembership.findFirst).not.toHaveBeenCalled();
  });

  it('does not query memberships when a route has no role requirement', async () => {
    jest.mocked(reflector.getAllAndOverride).mockReturnValue(undefined);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.communityMembership.findFirst).not.toHaveBeenCalled();
  });
});

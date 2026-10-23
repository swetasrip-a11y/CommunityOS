import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityRole,
  VisitorPassStatus,
  VisitorPurpose,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VisitorsService } from './visitors.service';

describe('VisitorsService', () => {
  const findMembership = jest.fn();
  const findMemberUnits = jest.fn();
  const findMemberUnit = jest.fn();
  const findPasses = jest.fn();
  const createPass = jest.fn();
  const findPass = jest.fn();
  const updatePassMany = jest.fn();
  const prisma = {
    communityMembership: { findFirst: findMembership },
    communityMembershipUnit: {
      findMany: findMemberUnits,
      findFirst: findMemberUnit,
    },
    visitorPass: {
      findMany: findPasses,
      create: createPass,
      findFirst: findPass,
      updateMany: updatePassMany,
    },
  } as unknown as PrismaService;
  let service: VisitorsService;

  const visitorPass = {
    id: 'pass-id',
    visitorName: 'Asha Kumar',
    purpose: VisitorPurpose.PERSONAL_VISIT,
    expectedAt: new Date(Date.now() + 60 * 60_000),
    status: VisitorPassStatus.EXPECTED,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date(),
    createdByMembership: { user: { fullName: 'Resident' } },
    unit: {
      id: 'unit-id',
      number: '204',
      block: { name: 'Tower A', code: 'A' },
    },
    checkedInBy: null,
    checkedOutBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VisitorsService(prisma);
    findMembership.mockResolvedValue({
      id: 'membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    findMemberUnits.mockResolvedValue([]);
    findMemberUnit.mockResolvedValue({ unitId: 'unit-id' });
    findPasses.mockResolvedValue([visitorPass]);
    createPass.mockResolvedValue(visitorPass);
    findPass.mockImplementation(({ select }) =>
      select.visitorName ? visitorPass : { status: VisitorPassStatus.EXPECTED },
    );
    updatePassMany.mockResolvedValue({ count: 1 });
  });

  it('lists only a resident’s visitor passes', async () => {
    await expect(
      service.listForCommunity('resident-id', 'community-id'),
    ).resolves.toMatchObject([
      { visitorName: 'Asha Kumar', hostName: 'Resident' },
    ]);
    expect(findPasses).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId: 'community-id',
          createdByMembershipId: 'membership-id',
        },
      }),
    );
  });

  it('lets security guards see all passes in their community', async () => {
    findMembership.mockResolvedValue({
      id: 'guard-membership-id',
      roles: [{ role: CommunityRole.SECURITY_GUARD }],
    });
    await service.listForCommunity('guard-id', 'community-id');
    expect(findPasses).toHaveBeenCalledWith(
      expect.objectContaining({ where: { communityId: 'community-id' } }),
    );
  });

  it('creates a pass only for a unit assigned to the active member', async () => {
    await expect(
      service.createForMember('resident-id', 'community-id', {
        visitorName: ' Asha Kumar ',
        unitId: 'unit-id',
        purpose: VisitorPurpose.PERSONAL_VISIT,
        expectedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      }),
    ).resolves.toMatchObject({
      id: 'pass-id',
      visitorName: 'Asha Kumar',
      status: VisitorPassStatus.EXPECTED,
      unit: { number: '204' },
    });
    expect(createPass).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: 'community-id',
          unitId: 'unit-id',
          createdByMembershipId: 'membership-id',
          visitorName: 'Asha Kumar',
        }),
      }),
    );

    findMemberUnit.mockResolvedValue(null);
    await expect(
      service.createForMember('resident-id', 'community-id', {
        visitorName: 'Visitor',
        unitId: 'other-unit',
        purpose: VisitorPurpose.DELIVERY,
        expectedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects past visitor arrival times', async () => {
    await expect(
      service.createForMember('resident-id', 'community-id', {
        visitorName: 'Visitor',
        unitId: 'unit-id',
        purpose: VisitorPurpose.DELIVERY,
        expectedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createPass).not.toHaveBeenCalled();
  });

  it('records security check-in and check-out details', async () => {
    findMembership.mockResolvedValue({
      id: 'guard-membership-id',
      roles: [{ role: CommunityRole.SECURITY_GUARD }],
    });
    await service.updateStatus(
      'guard-user-id',
      'community-id',
      'pass-id',
      VisitorPassStatus.CHECKED_IN,
    );
    expect(updatePassMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'pass-id',
          communityId: 'community-id',
          status: VisitorPassStatus.EXPECTED,
        },
        data: expect.objectContaining({
          status: VisitorPassStatus.CHECKED_IN,
          checkedInByUserId: 'guard-user-id',
        }),
      }),
    );
  });

  it('rejects resident status changes and concurrent updates', async () => {
    await expect(
      service.updateStatus(
        'resident-id',
        'community-id',
        'pass-id',
        VisitorPassStatus.CHECKED_IN,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    findMembership.mockResolvedValue({
      id: 'guard-membership-id',
      roles: [{ role: CommunityRole.SECURITY_GUARD }],
    });
    updatePassMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateStatus(
        'guard-id',
        'community-id',
        'pass-id',
        VisitorPassStatus.CHECKED_IN,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when the pass is outside the active community', async () => {
    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    findPass.mockResolvedValue(null);
    await expect(
      service.updateStatus(
        'admin-id',
        'community-id',
        'missing-id',
        VisitorPassStatus.CHECKED_IN,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires an active community membership', async () => {
    findMembership.mockResolvedValue(null);
    await expect(
      service.listForCommunity('outsider-id', 'community-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findPasses).not.toHaveBeenCalled();
  });
});

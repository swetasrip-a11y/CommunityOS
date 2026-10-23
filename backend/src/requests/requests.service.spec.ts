import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityRole,
  ServiceRequestCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  const findMembership = jest.fn();
  const findRequests = jest.fn();
  const createRequest = jest.fn();
  const findRequestForUpdate = jest.fn();
  const updateRequestMany = jest.fn();
  const createStatusUpdate = jest.fn();
  const findUpdatedRequest = jest.fn();
  const transaction = {
    serviceRequest: {
      findFirst: findRequestForUpdate,
      updateMany: updateRequestMany,
    },
    serviceRequestStatusUpdate: { create: createStatusUpdate },
  };
  const prisma = {
    communityMembership: { findFirst: findMembership },
    serviceRequest: { findMany: findRequests, create: createRequest },
    $transaction: jest.fn((callback) => callback(transaction)),
  } as unknown as PrismaService;
  let service: RequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RequestsService(prisma);
    findMembership.mockResolvedValue({
      id: 'membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    findRequests.mockResolvedValue([]);
    createRequest.mockResolvedValue({
      id: 'request-id',
      title: 'Water leak',
      category: ServiceRequestCategory.PLUMBING,
      description: 'Leak under kitchen sink',
      location: 'Apartment 204',
      status: ServiceRequestStatus.OPEN,
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T08:00:00Z'),
      createdByMembership: { user: { fullName: 'Test Resident' } },
      statusUpdates: [],
    });
    findRequestForUpdate.mockImplementation(({ select }) =>
      select.statusUpdates
        ? findUpdatedRequest()
        : { status: ServiceRequestStatus.OPEN },
    );
    updateRequestMany.mockResolvedValue({ count: 1 });
    createStatusUpdate.mockResolvedValue({});
    findUpdatedRequest.mockResolvedValue({
      id: 'request-id',
      title: 'Water leak',
      category: ServiceRequestCategory.PLUMBING,
      description: 'Leak under kitchen sink',
      location: 'Apartment 204',
      status: ServiceRequestStatus.IN_PROGRESS,
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T09:00:00Z'),
      createdByMembership: { user: { fullName: 'Test Resident' } },
      statusUpdates: [
        {
          id: 'update-id',
          previousStatus: ServiceRequestStatus.OPEN,
          status: ServiceRequestStatus.IN_PROGRESS,
          note: null,
          createdAt: new Date('2026-10-19T09:00:00Z'),
          updatedByMembership: { user: { fullName: 'Test Staff' } },
        },
      ],
    });
  });

  it('creates a request for an active member and returns it for immediate display', async () => {
    await expect(
      service.createForMember('resident-id', 'community-id', {
        title: ' Water leak ',
        category: ServiceRequestCategory.PLUMBING,
        location: ' Apartment 204 ',
        description: ' Leak under kitchen sink ',
      }),
    ).resolves.toEqual({
      id: 'request-id',
      title: 'Water leak',
      category: ServiceRequestCategory.PLUMBING,
      description: 'Leak under kitchen sink',
      location: 'Apartment 204',
      status: ServiceRequestStatus.OPEN,
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T08:00:00Z'),
      creatorName: 'Test Resident',
      statusHistory: [],
    });

    expect(createRequest).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        createdByMembershipId: 'membership-id',
        title: 'Water leak',
        category: ServiceRequestCategory.PLUMBING,
        location: 'Apartment 204',
        description: 'Leak under kitchen sink',
      },
      select: expect.objectContaining({
        id: true,
        createdByMembership: {
          select: { user: { select: { fullName: true } } },
        },
      }),
    });
  });

  it('returns only the resident’s requests and orders them newest first', async () => {
    await service.listForCommunity('resident-id', 'community-id');

    expect(findRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId: 'community-id',
          createdByMembershipId: 'membership-id',
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('allows administrators and maintenance staff to list community requests', async () => {
    for (const role of [
      CommunityRole.ADMINISTRATOR,
      CommunityRole.MAINTENANCE_STAFF,
    ]) {
      findMembership.mockResolvedValueOnce({
        id: `${role}-membership`,
        roles: [{ role }],
      });
      await service.listForCommunity('staff-id', 'community-id');
      expect(findRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { communityId: 'community-id' },
        }),
      );
    }
  });

  it('rejects request access for inactive community members', async () => {
    findMembership.mockResolvedValue(null);

    await expect(
      service.listForCommunity('outsider-id', 'community-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createForMember('outsider-id', 'community-id', {
        title: 'Water leak',
        category: ServiceRequestCategory.PLUMBING,
        location: 'Apartment 204',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findRequests).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('allows maintenance staff to advance status and records the actor and history', async () => {
    findMembership.mockResolvedValue({
      id: 'staff-membership-id',
      roles: [{ role: CommunityRole.MAINTENANCE_STAFF }],
    });

    await expect(
      service.updateStatus('staff-id', 'community-id', 'request-id', {
        status: ServiceRequestStatus.IN_PROGRESS,
      }),
    ).resolves.toMatchObject({
      status: ServiceRequestStatus.IN_PROGRESS,
      statusHistory: [
        {
          id: 'update-id',
          previousStatus: ServiceRequestStatus.OPEN,
          status: ServiceRequestStatus.IN_PROGRESS,
          updatedByName: 'Test Staff',
        },
      ],
    });
    expect(updateRequestMany).toHaveBeenCalledWith({
      where: {
        id: 'request-id',
        communityId: 'community-id',
        status: ServiceRequestStatus.OPEN,
      },
      data: { status: ServiceRequestStatus.IN_PROGRESS },
    });
    expect(createStatusUpdate).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        requestId: 'request-id',
        updatedByMembershipId: 'staff-membership-id',
        previousStatus: ServiceRequestStatus.OPEN,
        status: ServiceRequestStatus.IN_PROGRESS,
        note: null,
      },
    });
  });

  it('allows administrators to resolve in-progress requests with a trimmed note', async () => {
    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    findRequestForUpdate.mockImplementationOnce(({ select }) =>
      select.statusUpdates
        ? findUpdatedRequest()
        : { status: ServiceRequestStatus.IN_PROGRESS },
    );
    updateRequestMany.mockResolvedValueOnce({ count: 1 });
    findUpdatedRequest.mockReset().mockResolvedValueOnce({
      id: 'request-id',
      title: 'Water leak',
      category: ServiceRequestCategory.PLUMBING,
      description: 'Leak under kitchen sink',
      location: 'Apartment 204',
      status: ServiceRequestStatus.RESOLVED,
      createdAt: new Date('2026-10-19T08:00:00Z'),
      updatedAt: new Date('2026-10-19T10:00:00Z'),
      createdByMembership: { user: { fullName: 'Test Resident' } },
      statusUpdates: [
        {
          id: 'update-id',
          previousStatus: ServiceRequestStatus.OPEN,
          status: ServiceRequestStatus.IN_PROGRESS,
          note: null,
          createdAt: new Date('2026-10-19T09:00:00Z'),
          updatedByMembership: { user: { fullName: 'Test Staff' } },
        },
        {
          id: 'resolved-update-id',
          previousStatus: ServiceRequestStatus.IN_PROGRESS,
          status: ServiceRequestStatus.RESOLVED,
          note: 'Repair complete',
          createdAt: new Date('2026-10-19T10:00:00Z'),
          updatedByMembership: { user: { fullName: 'Test Admin' } },
        },
      ],
    });

    await expect(
      service.updateStatus('admin-id', 'community-id', 'request-id', {
        status: ServiceRequestStatus.RESOLVED,
        note: ' Repair complete ',
      }),
    ).resolves.toMatchObject({
      status: ServiceRequestStatus.RESOLVED,
      statusHistory: [
        expect.objectContaining({
          status: ServiceRequestStatus.IN_PROGRESS,
        }),
        expect.objectContaining({
          status: ServiceRequestStatus.RESOLVED,
          note: 'Repair complete',
          updatedByName: 'Test Admin',
        }),
      ],
    });
    expect(createStatusUpdate).toHaveBeenCalledWith({
      data: {
        communityId: 'community-id',
        requestId: 'request-id',
        updatedByMembershipId: 'admin-membership-id',
        previousStatus: ServiceRequestStatus.IN_PROGRESS,
        status: ServiceRequestStatus.RESOLVED,
        note: 'Repair complete',
      },
    });
  });

  it('rejects status changes from residents', async () => {
    await expect(
      service.updateStatus('resident-id', 'community-id', 'request-id', {
        status: ServiceRequestStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects skipped transitions and requests outside the community', async () => {
    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    await expect(
      service.updateStatus('admin-id', 'community-id', 'request-id', {
        status: ServiceRequestStatus.RESOLVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    findRequestForUpdate.mockImplementationOnce(({ select }) =>
      select.statusUpdates ? findUpdatedRequest() : null,
    );
    await expect(
      service.updateStatus('admin-id', 'community-id', 'missing-id', {
        status: ServiceRequestStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(createStatusUpdate).not.toHaveBeenCalled();
  });

  it('does not create history when a concurrent status update wins', async () => {
    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    updateRequestMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus('admin-id', 'community-id', 'request-id', {
        status: ServiceRequestStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createStatusUpdate).not.toHaveBeenCalled();
  });
});

import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CommunityRole,
  ServiceRequestCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Service requests (e2e)', () => {
  const communityId = '11111111-1111-4111-8111-111111111111';
  const requestId = '22222222-2222-4222-8222-222222222222';
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
            id: 'resident-user-id',
            email: 'resident@example.test',
            fullName: 'Test Resident',
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
    findMembership.mockResolvedValue({
      id: 'resident-membership-id',
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
      createdAt: new Date('2026-10-19T08:00:00.000Z'),
      updatedAt: new Date('2026-10-19T08:00:00.000Z'),
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
      createdAt: new Date('2026-10-19T08:00:00.000Z'),
      updatedAt: new Date('2026-10-19T09:00:00.000Z'),
      createdByMembership: { user: { fullName: 'Test Resident' } },
      statusUpdates: [
        {
          id: 'update-id',
          previousStatus: ServiceRequestStatus.OPEN,
          status: ServiceRequestStatus.IN_PROGRESS,
          note: 'Technician assigned',
          createdAt: new Date('2026-10-19T09:00:00.000Z'),
          updatedByMembership: { user: { fullName: 'Test Staff' } },
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a persisted request and returns the saved details', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/requests`)
      .send({
        title: ' Water leak ',
        category: 'PLUMBING',
        location: ' Apartment 204 ',
        description: ' Leak under kitchen sink ',
      })
      .expect(201)
      .expect({
        id: 'request-id',
        title: 'Water leak',
        category: 'PLUMBING',
        description: 'Leak under kitchen sink',
        location: 'Apartment 204',
        status: 'OPEN',
        createdAt: '2026-10-19T08:00:00.000Z',
        updatedAt: '2026-10-19T08:00:00.000Z',
        creatorName: 'Test Resident',
        statusHistory: [],
      });

    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId,
          createdByMembershipId: 'resident-membership-id',
          title: 'Water leak',
          category: ServiceRequestCategory.PLUMBING,
          location: 'Apartment 204',
        }),
      }),
    );
  });

  it('lists only the active resident’s requests', async () => {
    await request(app.getHttpServer())
      .get(`/communities/${communityId}/requests`)
      .expect(200)
      .expect([]);

    expect(findRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId,
          createdByMembershipId: 'resident-membership-id',
        },
      }),
    );
  });

  it('allows administrators to see all community requests', async () => {
    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });

    await request(app.getHttpServer())
      .get(`/communities/${communityId}/requests`)
      .expect(200);

    expect(findRequests).toHaveBeenCalledWith(
      expect.objectContaining({ where: { communityId } }),
    );
  });

  it('validates request data and blocks non-members', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/requests`)
      .send({
        title: '',
        category: 'UNKNOWN',
        location: '',
      })
      .expect(400);

    findMembership.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/requests`)
      .send({
        title: 'Water leak',
        category: 'PLUMBING',
        location: 'Apartment 204',
      })
      .expect(403);

    expect(createRequest).not.toHaveBeenCalled();
  });

  it('allows maintenance staff to update status and returns the persisted history', async () => {
    findMembership.mockResolvedValue({
      id: 'maintenance-membership-id',
      roles: [{ role: CommunityRole.MAINTENANCE_STAFF }],
    });

    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/requests/${requestId}/status`)
      .send({
        status: ServiceRequestStatus.IN_PROGRESS,
        note: 'Technician assigned',
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('IN_PROGRESS');
        expect(response.body.statusHistory).toEqual([
          expect.objectContaining({
            previousStatus: 'OPEN',
            status: 'IN_PROGRESS',
            note: 'Technician assigned',
            updatedByName: 'Test Staff',
          }),
        ]);
      });

    expect(createStatusUpdate).toHaveBeenCalledWith({
      data: {
        communityId,
        requestId,
        updatedByMembershipId: 'maintenance-membership-id',
        previousStatus: ServiceRequestStatus.OPEN,
        status: ServiceRequestStatus.IN_PROGRESS,
        note: 'Technician assigned',
      },
    });
  });

  it('rejects status changes from residents and invalid status payloads', async () => {
    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/requests/${requestId}/status`)
      .send({ status: ServiceRequestStatus.IN_PROGRESS })
      .expect(403);

    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/requests/${requestId}/status`)
      .send({ status: 'UNKNOWN' })
      .expect(400);
    expect(updateRequestMany).not.toHaveBeenCalled();
  });
});

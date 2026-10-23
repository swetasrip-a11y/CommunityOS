import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CommunityRole,
  VisitorPassStatus,
  VisitorPurpose,
} from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Visitor passes (e2e)', () => {
  const communityId = '11111111-1111-4111-8111-111111111111';
  const unitId = '22222222-2222-4222-8222-222222222222';
  const passId = '33333333-3333-4333-8333-333333333333';
  const findMembership = jest.fn();
  const findMemberUnits = jest.fn();
  const findMemberUnit = jest.fn();
  const findPasses = jest.fn();
  const createPass = jest.fn();
  const findPass = jest.fn();
  const updatePassMany = jest.fn();
  const record = {
    id: passId,
    visitorName: 'Asha Kumar',
    purpose: VisitorPurpose.PERSONAL_VISIT,
    expectedAt: new Date(Date.now() + 60 * 60_000),
    status: VisitorPassStatus.EXPECTED,
    checkedInAt: null,
    checkedOutAt: null,
    createdAt: new Date(),
    createdByMembership: { user: { fullName: 'Test Resident' } },
    unit: {
      id: unitId,
      number: '204',
      block: { name: 'Tower A', code: 'A' },
    },
    checkedInBy: null,
    checkedOutBy: null,
  };
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
    findMemberUnits.mockResolvedValue([{ unit: record.unit }]);
    findMemberUnit.mockResolvedValue({ unitId });
    findPasses.mockResolvedValue([record]);
    createPass.mockResolvedValue(record);
    findPass.mockImplementation(({ select }) =>
      select.visitorName ? record : { status: VisitorPassStatus.EXPECTED },
    );
    updatePassMany.mockResolvedValue({ count: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a resident’s passes and their assigned apartments', async () => {
    await request(app.getHttpServer())
      .get(`/communities/${communityId}/visitor-passes`)
      .expect(200)
      .expect((response) => {
        expect(response.body[0]).toMatchObject({
          visitorName: 'Asha Kumar',
          hostName: 'Test Resident',
          unit: { number: '204', block: { code: 'A' } },
          status: VisitorPassStatus.EXPECTED,
        });
      });

    await request(app.getHttpServer())
      .get(`/communities/${communityId}/visitor-passes/units`)
      .expect(200)
      .expect([{ ...record.unit }]);
    expect(findPasses).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId,
          createdByMembershipId: 'resident-membership-id',
        },
      }),
    );
  });

  it('creates a visitor pass for a member-linked apartment', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/visitor-passes`)
      .send({
        visitorName: ' Asha Kumar ',
        unitId,
        purpose: VisitorPurpose.PERSONAL_VISIT,
        expectedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          visitorName: 'Asha Kumar',
          status: VisitorPassStatus.EXPECTED,
        });
      });
    expect(createPass).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId,
          unitId,
          createdByMembershipId: 'resident-membership-id',
          visitorName: 'Asha Kumar',
        }),
      }),
    );
  });

  it('validates purpose and rejects apartments not assigned to the member', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/visitor-passes`)
      .send({
        visitorName: 'Visitor',
        unitId,
        purpose: 'UNKNOWN',
        expectedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .expect(400);

    findMemberUnit.mockResolvedValue(null);
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/visitor-passes`)
      .send({
        visitorName: 'Visitor',
        unitId,
        purpose: VisitorPurpose.DELIVERY,
        expectedAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      })
      .expect(403);
    expect(createPass).not.toHaveBeenCalled();
  });

  it('allows security guards to check visitors in and out', async () => {
    findMembership.mockResolvedValue({
      id: 'guard-membership-id',
      roles: [{ role: CommunityRole.SECURITY_GUARD }],
    });
    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/visitor-passes/${passId}/status`)
      .send({ status: VisitorPassStatus.CHECKED_IN })
      .expect(200);
    expect(updatePassMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: passId, communityId, status: VisitorPassStatus.EXPECTED },
        data: expect.objectContaining({
          status: VisitorPassStatus.CHECKED_IN,
          checkedInByUserId: 'resident-user-id',
        }),
      }),
    );

    findPass.mockImplementation(({ select }) =>
      select.visitorName ? record : { status: VisitorPassStatus.CHECKED_IN },
    );
    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/visitor-passes/${passId}/status`)
      .send({ status: VisitorPassStatus.CHECKED_OUT })
      .expect(200);
    expect(updatePassMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: passId,
          communityId,
          status: VisitorPassStatus.CHECKED_IN,
        },
        data: expect.objectContaining({
          status: VisitorPassStatus.CHECKED_OUT,
          checkedOutByUserId: 'resident-user-id',
        }),
      }),
    );
  });

  it('blocks residents from updating visitor entry status', async () => {
    await request(app.getHttpServer())
      .patch(`/communities/${communityId}/visitor-passes/${passId}/status`)
      .send({ status: VisitorPassStatus.CHECKED_IN })
      .expect(403);
    expect(updatePassMany).not.toHaveBeenCalled();
  });
});

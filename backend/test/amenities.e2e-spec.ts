import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AmenityBookingStatus, CommunityRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Amenities (e2e)', () => {
  const communityId = '11111111-1111-4111-8111-111111111111';
  const amenityId = '22222222-2222-4222-8222-222222222222';
  const bookingId = '33333333-3333-4333-8333-333333333333';
  const findMembership = jest.fn();
  const findAmenities = jest.fn();
  const createAmenity = jest.fn();
  const updateAmenities = jest.fn();
  const findAmenity = jest.fn();
  const findBookings = jest.fn();
  const findBooking = jest.fn();
  const updateBookings = jest.fn();
  const lockAmenity = jest.fn();
  const findAmenityInTransaction = jest.fn();
  const findOverlappingBooking = jest.fn();
  const createBooking = jest.fn();
  const transaction = {
    $queryRaw: lockAmenity,
    amenity: { findFirst: findAmenityInTransaction },
    amenityBooking: {
      findFirst: findOverlappingBooking,
      create: createBooking,
    },
  };
  const prisma = {
    communityMembership: { findFirst: findMembership },
    amenity: {
      findMany: findAmenities,
      create: createAmenity,
      updateMany: updateAmenities,
      findFirst: findAmenity,
    },
    amenityBooking: {
      findMany: findBookings,
      findFirst: findBooking,
      updateMany: updateBookings,
    },
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
    findAmenities.mockResolvedValue([]);
    createAmenity.mockResolvedValue({
      id: amenityId,
      name: 'Community gym',
      description: null,
      location: null,
      isActive: true,
    });
    updateAmenities.mockResolvedValue({ count: 1 });
    findAmenity.mockResolvedValue({
      id: amenityId,
      name: 'Community gym',
      description: null,
      location: null,
      isActive: false,
    });
    findBookings.mockResolvedValue([]);
    updateBookings.mockResolvedValue({ count: 1 });
    findBooking.mockResolvedValue({
      id: bookingId,
      amenityId,
      bookedByMembershipId: 'resident-membership-id',
      startsAt: new Date(Date.now() + 60 * 60_000),
      endsAt: new Date(Date.now() + 2 * 60 * 60_000),
      status: AmenityBookingStatus.CONFIRMED,
      amenity: { name: 'Community gym' },
      bookedByMembership: {
        id: 'resident-membership-id',
        user: { fullName: 'Test Resident' },
      },
    });
    lockAmenity.mockResolvedValue([]);
    findAmenityInTransaction.mockResolvedValue({ id: amenityId });
    findOverlappingBooking.mockResolvedValue(null);
    createBooking.mockResolvedValue({
      id: bookingId,
      amenityId,
      startsAt: new Date(Date.now() + 60 * 60_000),
      endsAt: new Date(Date.now() + 2 * 60 * 60_000),
      status: AmenityBookingStatus.CONFIRMED,
      amenity: { name: 'Community gym' },
      bookedByMembership: {
        id: 'resident-membership-id',
        user: { fullName: 'Test Resident' },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the active amenities and upcoming reservations', async () => {
    await request(app.getHttpServer())
      .get(`/communities/${communityId}/amenities`)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .get(`/communities/${communityId}/amenities/bookings`)
      .expect(200)
      .expect([]);
  });

  it('allows administrators to create amenities and prevents resident setup', async () => {
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/amenities`)
      .send({ name: 'Gym' })
      .expect(403);

    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    createAmenity.mockResolvedValue({
      id: amenityId,
      name: 'Community gym',
      description: null,
      location: 'Clubhouse',
      isActive: true,
    });
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/amenities`)
      .send({ name: ' Community gym ', location: 'Clubhouse' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          name: 'Community gym',
          location: 'Clubhouse',
          isActive: true,
        });
      });
  });

  it('validates and creates an amenity reservation', async () => {
    const startsAt = new Date(Date.now() + 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    await request(app.getHttpServer())
      .post(`/communities/${communityId}/amenities/bookings`)
      .send({
        amenityId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          amenityId,
          amenityName: 'Community gym',
          isMine: true,
          canCancel: true,
        });
      });

    await request(app.getHttpServer())
      .post(`/communities/${communityId}/amenities/bookings`)
      .send({ amenityId, startsAt: 'tomorrow', endsAt: 'later' })
      .expect(400);
  });

  it('allows cancellation of a member-owned booking', async () => {
    findBooking
      .mockResolvedValueOnce({
        id: bookingId,
        status: AmenityBookingStatus.CONFIRMED,
        bookedByMembershipId: 'resident-membership-id',
      })
      .mockResolvedValueOnce({
        id: bookingId,
        amenityId,
        startsAt: new Date(Date.now() + 60 * 60_000),
        endsAt: new Date(Date.now() + 2 * 60 * 60_000),
        status: AmenityBookingStatus.CANCELLED,
        amenity: { name: 'Community gym' },
        bookedByMembership: {
          id: 'resident-membership-id',
          user: { fullName: 'Test Resident' },
        },
      });
    await request(app.getHttpServer())
      .post(
        `/communities/${communityId}/amenities/bookings/${bookingId}/cancel`,
      )
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe(AmenityBookingStatus.CANCELLED);
      });
    expect(updateBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: bookingId,
          communityId,
          status: AmenityBookingStatus.CONFIRMED,
        },
      }),
    );
  });
});

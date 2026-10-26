import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AmenityBookingStatus, CommunityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AmenitiesService } from './amenities.service';

describe('AmenitiesService', () => {
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
  let service: AmenitiesService;

  const amenity = {
    id: 'amenity-id',
    name: 'Community gym',
    description: null,
    location: 'Clubhouse',
    isActive: true,
  };

  const booking = {
    id: 'booking-id',
    amenityId: 'amenity-id',
    bookedByMembershipId: 'resident-membership-id',
    startsAt: new Date(Date.now() + 60 * 60_000),
    endsAt: new Date(Date.now() + 2 * 60 * 60_000),
    status: AmenityBookingStatus.CONFIRMED,
    amenity: { name: 'Community gym' },
    bookedByMembership: {
      id: 'resident-membership-id',
      user: { fullName: 'Test Resident' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AmenitiesService(prisma);
    findMembership.mockResolvedValue({
      id: 'resident-membership-id',
      roles: [{ role: CommunityRole.RESIDENT }],
    });
    findAmenities.mockResolvedValue([amenity]);
    createAmenity.mockResolvedValue(amenity);
    updateAmenities.mockResolvedValue({ count: 1 });
    findAmenity.mockResolvedValue(amenity);
    findBookings.mockResolvedValue([booking]);
    findBooking.mockResolvedValue(booking);
    updateBookings.mockResolvedValue({ count: 1 });
    lockAmenity.mockResolvedValue([]);
    findAmenityInTransaction.mockResolvedValue({ id: amenity.id });
    findOverlappingBooking.mockResolvedValue(null);
    createBooking.mockResolvedValue(booking);
  });

  it('shows active amenities to members and allows admins to manage the catalog', async () => {
    await service.listForCommunity('resident-user-id', 'community-id');
    expect(findAmenities).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { communityId: 'community-id', isActive: true },
      }),
    );

    findMembership.mockResolvedValue({
      id: 'admin-membership-id',
      roles: [{ role: CommunityRole.ADMINISTRATOR }],
    });
    await service.createAmenity('admin-user-id', 'community-id', {
      name: ' Community gym ',
      description: ' Open daily ',
      location: ' Clubhouse ',
    });
    expect(createAmenity).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          communityId: 'community-id',
          name: 'Community gym',
          description: 'Open daily',
          location: 'Clubhouse',
        },
      }),
    );
  });

  it('prevents residents from creating amenities', async () => {
    await expect(
      service.createAmenity('resident-user-id', 'community-id', {
        name: 'Gym',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createAmenity).not.toHaveBeenCalled();
  });

  it('creates future bookings and serializes availability checks per amenity', async () => {
    const startsAt = new Date(Date.now() + 60 * 60_000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
    await expect(
      service.createBooking('resident-user-id', 'community-id', {
        amenityId: 'amenity-id',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    ).resolves.toMatchObject({
      id: 'booking-id',
      amenityName: 'Community gym',
      isMine: true,
      canCancel: true,
    });
    expect(lockAmenity).toHaveBeenCalled();
    expect(lockAmenity.mock.calls[0][0].join('')).toContain('::bigint');
    expect(findOverlappingBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          amenityId: 'amenity-id',
          status: AmenityBookingStatus.CONFIRMED,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        }),
      }),
    );
  });

  it('rejects invalid duration and overlapping reservations', async () => {
    const startsAt = new Date(Date.now() + 60 * 60_000);
    await expect(
      service.createBooking('resident-user-id', 'community-id', {
        amenityId: 'amenity-id',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 5 * 60 * 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    findOverlappingBooking.mockResolvedValue({ id: 'existing-booking' });
    await expect(
      service.createBooking('resident-user-id', 'community-id', {
        amenityId: 'amenity-id',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createBooking).not.toHaveBeenCalled();
  });

  it('hides other residents’ names and disallows cancelling their bookings', async () => {
    findBookings.mockResolvedValue([
      {
        ...booking,
        bookedByMembership: {
          id: 'other-membership-id',
          user: { fullName: 'Another Resident' },
        },
      },
    ]);
    await expect(
      service.listBookings('resident-user-id', 'community-id'),
    ).resolves.toMatchObject([
      { bookedByName: null, isMine: false, canCancel: false },
    ]);

    findBooking.mockResolvedValue({
      id: 'booking-id',
      status: AmenityBookingStatus.CONFIRMED,
      bookedByMembershipId: 'other-membership-id',
    });
    await expect(
      service.cancelBooking('resident-user-id', 'community-id', 'booking-id'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateBookings).not.toHaveBeenCalled();
  });

  it('lets a member cancel their own reservation', async () => {
    findBooking
      .mockResolvedValueOnce({
        id: 'booking-id',
        status: AmenityBookingStatus.CONFIRMED,
        bookedByMembershipId: 'resident-membership-id',
      })
      .mockResolvedValueOnce({
        ...booking,
        status: AmenityBookingStatus.CANCELLED,
      });
    await expect(
      service.cancelBooking('resident-user-id', 'community-id', 'booking-id'),
    ).resolves.toMatchObject({ status: AmenityBookingStatus.CANCELLED });
    expect(updateBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-id',
          communityId: 'community-id',
          status: AmenityBookingStatus.CONFIRMED,
        },
        data: { status: AmenityBookingStatus.CANCELLED },
      }),
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AmenityBookingStatus,
  CommunityRole,
  MembershipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAmenityBookingDto } from './dto/create-amenity-booking.dto';
import { CreateAmenityDto } from './dto/create-amenity.dto';

export interface AmenitySummary {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  isActive: boolean;
}

export interface AmenityBookingSummary {
  id: string;
  amenityId: string;
  amenityName: string;
  startsAt: Date;
  endsAt: Date;
  status: AmenityBookingStatus;
  bookedByName: string | null;
  isMine: boolean;
  canCancel: boolean;
}

const amenitySelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  isActive: true,
};

const bookingSelect = {
  id: true,
  amenityId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  amenity: { select: { name: true } },
  bookedByMembership: {
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
  },
};

const MAX_BOOKING_DURATION_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCommunity(
    userId: string,
    communityId: string,
  ): Promise<AmenitySummary[]> {
    const membership = await this.findActiveMembership(userId, communityId);
    const isAdministrator = this.hasRole(
      membership.roles,
      CommunityRole.ADMINISTRATOR,
    );
    const amenities = await this.prisma.amenity.findMany({
      where: { communityId, ...(!isAdministrator ? { isActive: true } : {}) },
      select: amenitySelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return amenities;
  }

  async createAmenity(
    userId: string,
    communityId: string,
    dto: CreateAmenityDto,
  ): Promise<AmenitySummary> {
    await this.requireAdministrator(userId, communityId);
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Amenity name must not be empty');
    }

    return this.prisma.amenity.create({
      data: {
        communityId,
        name,
        description: dto.description?.trim() || null,
        location: dto.location?.trim() || null,
      },
      select: amenitySelect,
    });
  }

  async setAvailability(
    userId: string,
    communityId: string,
    amenityId: string,
    isActive: boolean,
  ): Promise<AmenitySummary> {
    await this.requireAdministrator(userId, communityId);
    const updated = await this.prisma.amenity.updateMany({
      where: { id: amenityId, communityId },
      data: { isActive },
    });
    if (updated.count !== 1) {
      throw new NotFoundException('Amenity not found');
    }

    const amenity = await this.prisma.amenity.findFirst({
      where: { id: amenityId, communityId },
      select: amenitySelect,
    });
    if (!amenity) {
      throw new NotFoundException('Amenity not found');
    }
    return amenity;
  }

  async listBookings(
    userId: string,
    communityId: string,
  ): Promise<AmenityBookingSummary[]> {
    const membership = await this.findActiveMembership(userId, communityId);
    const isAdministrator = this.hasRole(
      membership.roles,
      CommunityRole.ADMINISTRATOR,
    );
    const now = new Date();
    const bookings = await this.prisma.amenityBooking.findMany({
      where: {
        communityId,
        startsAt: { gte: now },
        OR: [
          { status: AmenityBookingStatus.CONFIRMED },
          { bookedByMembershipId: membership.id },
        ],
      },
      select: bookingSelect,
      orderBy: [{ startsAt: 'asc' }, { amenity: { name: 'asc' } }],
      take: 200,
    });
    return bookings.map((booking) =>
      this.toBookingSummary(booking, membership.id, isAdministrator),
    );
  }

  async createBooking(
    userId: string,
    communityId: string,
    dto: CreateAmenityBookingDto,
  ): Promise<AmenityBookingSummary> {
    const membership = await this.findActiveMembership(userId, communityId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    const duration = endsAt.getTime() - startsAt.getTime();
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt.getTime() <= Date.now() ||
      duration <= 0 ||
      duration > MAX_BOOKING_DURATION_MS
    ) {
      throw new BadRequestException(
        'Choose a future time range no longer than four hours',
      );
    }

    const booking = await this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        await transaction.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${dto.amenityId}))
        `;
        const amenity = await transaction.amenity.findFirst({
          where: { id: dto.amenityId, communityId, isActive: true },
          select: { id: true },
        });
        if (!amenity) {
          throw new NotFoundException('Active amenity not found');
        }

        const overlappingBooking = await transaction.amenityBooking.findFirst({
          where: {
            communityId,
            amenityId: dto.amenityId,
            status: AmenityBookingStatus.CONFIRMED,
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (overlappingBooking) {
          throw new ConflictException(
            'This amenity is already booked during that time',
          );
        }

        return transaction.amenityBooking.create({
          data: {
            communityId,
            amenityId: amenity.id,
            bookedByMembershipId: membership.id,
            startsAt,
            endsAt,
          },
          select: bookingSelect,
        });
      },
    );
    return this.toBookingSummary(booking, membership.id, false);
  }

  async cancelBooking(
    userId: string,
    communityId: string,
    bookingId: string,
  ): Promise<AmenityBookingSummary> {
    const membership = await this.findActiveMembership(userId, communityId);
    const isAdministrator = this.hasRole(
      membership.roles,
      CommunityRole.ADMINISTRATOR,
    );
    const booking = await this.prisma.amenityBooking.findFirst({
      where: { id: bookingId, communityId },
      select: {
        id: true,
        status: true,
        bookedByMembershipId: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Amenity booking not found');
    }
    if (!isAdministrator && booking.bookedByMembershipId !== membership.id) {
      throw new ForbiddenException(
        'You can only cancel bookings made by your membership',
      );
    }
    if (booking.status !== AmenityBookingStatus.CONFIRMED) {
      throw new BadRequestException('This booking has already been cancelled');
    }

    const updated = await this.prisma.amenityBooking.updateMany({
      where: {
        id: bookingId,
        communityId,
        status: AmenityBookingStatus.CONFIRMED,
      },
      data: { status: AmenityBookingStatus.CANCELLED },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'This booking was updated by someone else. Reload and try again.',
      );
    }

    const result = await this.prisma.amenityBooking.findFirst({
      where: { id: bookingId, communityId },
      select: bookingSelect,
    });
    if (!result) {
      throw new NotFoundException('Amenity booking not found');
    }
    return this.toBookingSummary(result, membership.id, isAdministrator);
  }

  private async findActiveMembership(userId: string, communityId: string) {
    const membership = await this.prisma.communityMembership.findFirst({
      where: {
        userId,
        communityId,
        status: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
        roles: { select: { role: true } },
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'An active membership in this community is required',
      );
    }
    return membership;
  }

  private async requireAdministrator(userId: string, communityId: string) {
    const membership = await this.findActiveMembership(userId, communityId);
    if (!this.hasRole(membership.roles, CommunityRole.ADMINISTRATOR)) {
      throw new ForbiddenException(
        'Only administrators can manage community amenities',
      );
    }
  }

  private hasRole(
    roles: { role: CommunityRole }[],
    role: CommunityRole,
  ): boolean {
    return roles.some((membershipRole) => membershipRole.role === role);
  }

  private toBookingSummary(
    booking: Prisma.AmenityBookingGetPayload<{
      select: typeof bookingSelect;
    }>,
    membershipId: string,
    isAdministrator: boolean,
  ): AmenityBookingSummary {
    const isMine = booking.bookedByMembership.id === membershipId;
    return {
      id: booking.id,
      amenityId: booking.amenityId,
      amenityName: booking.amenity.name,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
      bookedByName:
        isAdministrator || isMine
          ? booking.bookedByMembership.user.fullName
          : null,
      isMine,
      canCancel:
        booking.status === AmenityBookingStatus.CONFIRMED &&
        (isAdministrator || isMine),
    };
  }
}

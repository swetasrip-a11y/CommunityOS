import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommunityRole,
  MembershipStatus,
  Prisma,
  ServiceRequestCategory,
  ServiceRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestStatusDto } from './dto/update-service-request-status.dto';

export interface ServiceRequestStatusUpdateSummary {
  id: string;
  previousStatus: ServiceRequestStatus;
  status: ServiceRequestStatus;
  note: string | null;
  createdAt: Date;
  updatedByName: string;
}

export interface ServiceRequestSummary {
  id: string;
  title: string;
  category: ServiceRequestCategory;
  description: string | null;
  location: string;
  status: ServiceRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  creatorName: string;
  statusHistory: ServiceRequestStatusUpdateSummary[];
}

const serviceRequestSelect = {
  id: true,
  title: true,
  category: true,
  description: true,
  location: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdByMembership: {
    select: { user: { select: { fullName: true } } },
  },
  statusUpdates: {
    select: {
      id: true,
      previousStatus: true,
      status: true,
      note: true,
      createdAt: true,
      updatedByMembership: {
        select: { user: { select: { fullName: true } } },
      },
    },
    orderBy: [{ createdAt: 'asc' as const }, { status: 'asc' as const }],
  },
};

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCommunity(
    userId: string,
    communityId: string,
  ): Promise<ServiceRequestSummary[]> {
    const membership = await this.findActiveMembership(userId, communityId);
    const canViewCommunityRequests = membership.roles.some(
      ({ role }) =>
        role === CommunityRole.ADMINISTRATOR ||
        role === CommunityRole.MAINTENANCE_STAFF,
    );

    const records = await this.prisma.serviceRequest.findMany({
      where: {
        communityId,
        ...(canViewCommunityRequests
          ? {}
          : { createdByMembershipId: membership.id }),
      },
      select: serviceRequestSelect,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.toSummary(record));
  }

  async createForMember(
    userId: string,
    communityId: string,
    dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestSummary> {
    const membership = await this.findActiveMembership(userId, communityId);
    const title = dto.title.trim();
    const location = dto.location.trim();
    const description = dto.description?.trim() || null;
    if (!title || !location) {
      throw new BadRequestException('Request title and location are required');
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        communityId,
        createdByMembershipId: membership.id,
        title,
        category: dto.category,
        location,
        description,
      },
      select: serviceRequestSelect,
    });

    return this.toSummary(created);
  }

  async updateStatus(
    userId: string,
    communityId: string,
    requestId: string,
    dto: UpdateServiceRequestStatusDto,
  ): Promise<ServiceRequestSummary> {
    const membership = await this.findActiveMembership(userId, communityId);
    const canManageRequests = membership.roles.some(
      ({ role }) =>
        role === CommunityRole.ADMINISTRATOR ||
        role === CommunityRole.MAINTENANCE_STAFF,
    );
    if (!canManageRequests) {
      throw new ForbiddenException(
        'Only administrators and maintenance staff can update request status',
      );
    }

    const note = dto.note?.trim() || null;
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient) => {
        const current = await transaction.serviceRequest.findFirst({
          where: { id: requestId, communityId },
          select: { status: true },
        });
        if (!current) {
          throw new NotFoundException('Service request not found');
        }

        const allowedNextStatus =
          current.status === ServiceRequestStatus.OPEN
            ? ServiceRequestStatus.IN_PROGRESS
            : current.status === ServiceRequestStatus.IN_PROGRESS
              ? ServiceRequestStatus.RESOLVED
              : null;
        if (dto.status !== allowedNextStatus) {
          throw new BadRequestException(
            current.status === ServiceRequestStatus.RESOLVED
              ? 'Resolved requests cannot be changed'
              : `A request in ${current.status} status can only move to ${allowedNextStatus}`,
          );
        }

        const updated = await transaction.serviceRequest.updateMany({
          where: {
            id: requestId,
            communityId,
            status: current.status,
          },
          data: { status: dto.status },
        });
        if (updated.count !== 1) {
          throw new ConflictException(
            'This request was updated by someone else. Reload and try again.',
          );
        }

        await transaction.serviceRequestStatusUpdate.create({
          data: {
            communityId,
            requestId,
            updatedByMembershipId: membership.id,
            previousStatus: current.status,
            status: dto.status,
            note,
          },
        });

        const result = await transaction.serviceRequest.findFirst({
          where: { id: requestId, communityId },
          select: serviceRequestSelect,
        });
        if (!result) {
          throw new NotFoundException('Service request not found');
        }
        return this.toSummary(result);
      },
    );
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

  private toSummary(
    record: Prisma.ServiceRequestGetPayload<{
      select: typeof serviceRequestSelect;
    }>,
  ): ServiceRequestSummary {
    return {
      id: record.id,
      title: record.title,
      category: record.category,
      description: record.description,
      location: record.location,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      creatorName: record.createdByMembership.user.fullName,
      statusHistory: record.statusUpdates.map((update) => ({
        id: update.id,
        previousStatus: update.previousStatus,
        status: update.status,
        note: update.note,
        createdAt: update.createdAt,
        updatedByName: update.updatedByMembership.user.fullName,
      })),
    };
  }
}

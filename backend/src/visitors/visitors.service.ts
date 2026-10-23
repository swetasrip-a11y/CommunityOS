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
  VisitorPurpose,
  VisitorPassStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitorPassDto } from './dto/create-visitor-pass.dto';

export interface VisitorUnitSummary {
  id: string;
  number: string;
  block: { name: string; code: string };
}

export interface VisitorPassSummary {
  id: string;
  visitorName: string;
  purpose: VisitorPurpose;
  expectedAt: Date;
  status: VisitorPassStatus;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  createdAt: Date;
  hostName: string;
  unit: VisitorUnitSummary;
  checkedInByName: string | null;
  checkedOutByName: string | null;
}

const visitorPassSelect = {
  id: true,
  visitorName: true,
  purpose: true,
  expectedAt: true,
  status: true,
  checkedInAt: true,
  checkedOutAt: true,
  createdAt: true,
  createdByMembership: {
    select: { user: { select: { fullName: true } } },
  },
  unit: {
    select: {
      id: true,
      number: true,
      block: { select: { name: true, code: true } },
    },
  },
  checkedInBy: { select: { fullName: true } },
  checkedOutBy: { select: { fullName: true } },
};

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMemberUnits(
    userId: string,
    communityId: string,
  ): Promise<VisitorUnitSummary[]> {
    const membership = await this.findActiveMembership(userId, communityId);
    const units = await this.prisma.communityMembershipUnit.findMany({
      where: { communityId, membershipId: membership.id },
      select: {
        unit: {
          select: {
            id: true,
            number: true,
            block: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: [
        { unit: { block: { code: 'asc' } } },
        { unit: { number: 'asc' } },
      ],
    });
    return units.map(({ unit }) => unit);
  }

  async listForCommunity(
    userId: string,
    communityId: string,
  ): Promise<VisitorPassSummary[]> {
    const membership = await this.findActiveMembership(userId, communityId);
    const canViewAll = membership.roles.some(
      ({ role }) =>
        role === CommunityRole.ADMINISTRATOR ||
        role === CommunityRole.SECURITY_GUARD,
    );
    const records = await this.prisma.visitorPass.findMany({
      where: {
        communityId,
        ...(canViewAll ? {} : { createdByMembershipId: membership.id }),
      },
      select: visitorPassSelect,
      orderBy: [{ expectedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map((record) => this.toSummary(record));
  }

  async createForMember(
    userId: string,
    communityId: string,
    dto: CreateVisitorPassDto,
  ): Promise<VisitorPassSummary> {
    const membership = await this.findActiveMembership(userId, communityId);
    const visitorName = dto.visitorName.trim();
    const purpose = dto.purpose;
    const expectedAt = new Date(dto.expectedAt);
    if (!visitorName || Number.isNaN(expectedAt.getTime())) {
      throw new BadRequestException(
        'Visitor name, purpose, and arrival time are required',
      );
    }
    if (expectedAt.getTime() <= Date.now()) {
      throw new BadRequestException('Expected arrival must be in the future');
    }

    const unit = await this.prisma.communityMembershipUnit.findFirst({
      where: {
        communityId,
        membershipId: membership.id,
        unitId: dto.unitId,
      },
      select: { unitId: true },
    });
    if (!unit) {
      throw new ForbiddenException(
        'A visitor pass can only be created for an apartment linked to your membership',
      );
    }

    const record = await this.prisma.visitorPass.create({
      data: {
        communityId,
        unitId: unit.unitId,
        createdByMembershipId: membership.id,
        visitorName,
        purpose,
        expectedAt,
      },
      select: visitorPassSelect,
    });
    return this.toSummary(record);
  }

  async updateStatus(
    userId: string,
    communityId: string,
    passId: string,
    status: VisitorPassStatus,
  ): Promise<VisitorPassSummary> {
    await this.requireSecurityStaff(userId, communityId);
    const current = await this.prisma.visitorPass.findFirst({
      where: { id: passId, communityId },
      select: { status: true },
    });
    if (!current) {
      throw new NotFoundException('Visitor pass not found');
    }

    const expectedStatus =
      status === VisitorPassStatus.CHECKED_IN
        ? VisitorPassStatus.EXPECTED
        : status === VisitorPassStatus.CHECKED_OUT
          ? VisitorPassStatus.CHECKED_IN
          : null;
    if (
      status === VisitorPassStatus.EXPECTED ||
      current.status !== expectedStatus
    ) {
      throw new BadRequestException(
        current.status === VisitorPassStatus.CHECKED_OUT
          ? 'A checked-out visitor pass cannot be changed'
          : `A visitor in ${current.status} status cannot move to ${status}`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.visitorPass.updateMany({
      where: { id: passId, communityId, status: current.status },
      data: {
        status,
        ...(status === VisitorPassStatus.CHECKED_IN
          ? { checkedInAt: now, checkedInByUserId: userId }
          : { checkedOutAt: now, checkedOutByUserId: userId }),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'This visitor pass was updated by someone else. Reload and try again.',
      );
    }

    const record = await this.prisma.visitorPass.findFirst({
      where: { id: passId, communityId },
      select: visitorPassSelect,
    });
    if (!record) {
      throw new NotFoundException('Visitor pass not found');
    }
    return this.toSummary(record);
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

  private async requireSecurityStaff(userId: string, communityId: string) {
    const membership = await this.findActiveMembership(userId, communityId);
    if (
      !membership.roles.some(
        ({ role }) =>
          role === CommunityRole.ADMINISTRATOR ||
          role === CommunityRole.SECURITY_GUARD,
      )
    ) {
      throw new ForbiddenException(
        'Only administrators and security guards can update visitor entry status',
      );
    }
  }

  private toSummary(
    record: Prisma.VisitorPassGetPayload<{
      select: typeof visitorPassSelect;
    }>,
  ): VisitorPassSummary {
    return {
      id: record.id,
      visitorName: record.visitorName,
      purpose: record.purpose,
      expectedAt: record.expectedAt,
      status: record.status,
      checkedInAt: record.checkedInAt,
      checkedOutAt: record.checkedOutAt,
      createdAt: record.createdAt,
      hostName: record.createdByMembership.user.fullName,
      unit: record.unit,
      checkedInByName: record.checkedInBy?.fullName ?? null,
      checkedOutByName: record.checkedOutBy?.fullName ?? null,
    };
  }
}

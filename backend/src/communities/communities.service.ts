import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityRole, MembershipStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { RedeemInvitationDto } from './dto/redeem-invitation.dto';

const INVITATION_LIFETIME_DAYS = 7;

export type CommunityInvitationStatus =
  'ACTIVE' | 'EXPIRED' | 'REDEEMED' | 'REVOKED';

export interface CommunityInvitationSummary {
  id: string;
  unit: {
    id: string;
    number: string;
    block: { name: string; code: string };
  };
  createdAt: Date;
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
  status: CommunityInvitationStatus;
}

export interface CreatedCommunityInvitation {
  id: string;
  code: string;
  expiresAt: Date;
}

export interface CommunityUnitSummary {
  id: string;
  number: string;
  floor: number | null;
}

export interface CommunityBlockSummary {
  id: string;
  name: string;
  code: string;
  units: CommunityUnitSummary[];
}

export interface CommunityStructure {
  id: string;
  name: string;
  slug: string;
  blocks: CommunityBlockSummary[];
}

export interface CommunityMembershipSummary {
  membershipId: string;
  community: {
    id: string;
    name: string;
    slug: string;
  };
  roles: CommunityRole[];
}

export interface CommunityMemberRoleSummary {
  membershipId: string;
  fullName: string;
  email: string;
  roles: CommunityRole[];
}

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<CommunityMembershipSummary[]> {
    const memberships = await this.prisma.communityMembership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      include: {
        community: { select: { id: true, name: true, slug: true } },
        roles: { select: { role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      community: membership.community,
      roles: membership.roles.map(({ role }) => role),
    }));
  }

  async listCommunityMembers(
    userId: string,
    communityId: string,
  ): Promise<CommunityMemberRoleSummary[]> {
    await this.requireAdministrator(userId, communityId);
    const members = await this.prisma.communityMembership.findMany({
      where: { communityId, status: MembershipStatus.ACTIVE },
      select: {
        id: true,
        user: { select: { fullName: true, email: true } },
        roles: { select: { role: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
    return members.map((member) => ({
      membershipId: member.id,
      fullName: member.user.fullName,
      email: member.user.email,
      roles: member.roles.map(({ role }) => role),
    }));
  }

  async setSecurityRole(
    userId: string,
    communityId: string,
    membershipId: string,
    enabled: boolean,
  ): Promise<CommunityMemberRoleSummary> {
    await this.requireAdministrator(userId, communityId);
    const target = await this.prisma.communityMembership.findFirst({
      where: {
        id: membershipId,
        communityId,
        status: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
        user: { select: { fullName: true, email: true } },
      },
    });
    if (!target) {
      throw new NotFoundException('Active community member not found');
    }

    if (enabled) {
      await this.prisma.communityMembershipRole.createMany({
        data: [
          { communityId, membershipId, role: CommunityRole.SECURITY_GUARD },
        ],
        skipDuplicates: true,
      });
    } else {
      await this.prisma.communityMembershipRole.deleteMany({
        where: {
          communityId,
          membershipId,
          role: CommunityRole.SECURITY_GUARD,
        },
      });
    }

    const roles = await this.prisma.communityMembershipRole.findMany({
      where: { communityId, membershipId },
      select: { role: true },
    });
    return {
      membershipId: target.id,
      fullName: target.user.fullName,
      email: target.user.email,
      roles: roles.map(({ role }) => role),
    };
  }

  async createForOwner(
    userId: string,
    dto: CreateCommunityDto,
  ): Promise<CommunityMembershipSummary> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Community name must not be empty');
    }

    const baseSlug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 55)
      .replace(/-+$/g, '');
    const slug = `${baseSlug || 'community'}-${randomBytes(8).toString('hex')}`;

    try {
      return await this.prisma.$transaction(
        async (transaction: Prisma.TransactionClient) => {
          const community = await transaction.community.create({
            data: { name, slug },
            select: { id: true, name: true, slug: true },
          });
          const membership = await transaction.communityMembership.create({
            data: {
              communityId: community.id,
              userId,
              status: MembershipStatus.ACTIVE,
            },
            select: { id: true },
          });
          await transaction.communityMembershipRole.create({
            data: {
              communityId: community.id,
              membershipId: membership.id,
              role: CommunityRole.ADMINISTRATOR,
            },
          });

          return {
            membershipId: membership.id,
            community,
            roles: [CommunityRole.ADMINISTRATOR],
          };
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Could not create this community. Please try again.',
        );
      }
      throw error;
    }
  }

  async getStructure(
    userId: string,
    communityId: string,
  ): Promise<CommunityStructure> {
    const isAdministrator = await this.requireActiveMembership(
      userId,
      communityId,
    );

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        id: true,
        name: true,
        slug: true,
        blocks: {
          select: {
            id: true,
            name: true,
            code: true,
            units: {
              select: { id: true, number: true, floor: true },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }
    return {
      ...community,
      blocks: community.blocks.map((block) => ({
        ...block,
        units: isAdministrator ? block.units : [],
      })),
    };
  }

  async createBlock(
    userId: string,
    communityId: string,
    dto: CreateBlockDto,
  ): Promise<CommunityBlockSummary> {
    await this.requireAdministrator(userId, communityId);
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    if (!name || !code) {
      throw new BadRequestException('Block name and code must not be empty');
    }

    try {
      return await this.prisma.block.create({
        data: { communityId, name, code },
        select: {
          id: true,
          name: true,
          code: true,
          units: {
            select: { id: true, number: true, floor: true },
            orderBy: { number: 'asc' },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A block with this code already exists in this community',
        );
      }
      throw error;
    }
  }

  async createUnit(
    userId: string,
    communityId: string,
    blockId: string,
    dto: CreateUnitDto,
  ): Promise<CommunityUnitSummary> {
    await this.requireAdministrator(userId, communityId);
    const number = dto.number.trim();
    if (!number) {
      throw new BadRequestException('Apartment number must not be empty');
    }

    try {
      return await this.prisma.unit.create({
        data: {
          communityId,
          blockId,
          number,
          ...(dto.floor === undefined ? {} : { floor: dto.floor }),
        },
        select: { id: true, number: true, floor: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This apartment number already exists in the selected block',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Block not found in this community');
      }
      throw error;
    }
  }

  async listInvitations(
    userId: string,
    communityId: string,
  ): Promise<CommunityInvitationSummary[]> {
    await this.requireAdministrator(userId, communityId);
    const now = new Date();
    const invitations = await this.prisma.communityInvitation.findMany({
      where: { communityId },
      select: {
        id: true,
        unit: {
          select: {
            id: true,
            number: true,
            block: { select: { name: true, code: true } },
          },
        },
        createdAt: true,
        expiresAt: true,
        redeemedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((invitation) => ({
      ...invitation,
      status: invitation.redeemedAt
        ? 'REDEEMED'
        : invitation.revokedAt
          ? 'REVOKED'
          : invitation.expiresAt <= now
            ? 'EXPIRED'
            : 'ACTIVE',
    }));
  }

  async createInvitation(
    userId: string,
    communityId: string,
    dto: CreateInvitationDto,
  ): Promise<CreatedCommunityInvitation> {
    await this.requireAdministrator(userId, communityId);
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, communityId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Apartment not found in this community');
    }

    const rawCode = randomBytes(16).toString('hex').toUpperCase();
    const code = rawCode.replace(/(.{4})/g, '$1-').slice(0, -1);
    const expiresAt = new Date(
      Date.now() + INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
    );
    const invitation = await this.prisma.communityInvitation.create({
      data: {
        communityId,
        unitId: unit.id,
        createdByUserId: userId,
        codeHash: this.hashInvitationCode(rawCode),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });

    return { ...invitation, code };
  }

  async revokeInvitation(
    userId: string,
    communityId: string,
    invitationId: string,
  ): Promise<{ revoked: true }> {
    await this.requireAdministrator(userId, communityId);
    const now = new Date();
    const result = await this.prisma.communityInvitation.updateMany({
      where: {
        id: invitationId,
        communityId,
        redeemedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    if (result.count === 1) return { revoked: true };

    const invitation = await this.prisma.communityInvitation.findFirst({
      where: { id: invitationId, communityId },
      select: { id: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found in this community');
    }
    throw new ConflictException(
      'This invitation is already used, expired, or revoked',
    );
  }

  async redeemInvitation(
    userId: string,
    dto: RedeemInvitationDto,
  ): Promise<CommunityMembershipSummary> {
    const code = dto.code.replace(/-/g, '').toUpperCase();
    if (!/^[A-F0-9]{32}$/.test(code)) {
      throw new BadRequestException('Enter a valid invitation code');
    }
    const codeHash = this.hashInvitationCode(code);
    const invitation = await this.prisma.communityInvitation.findUnique({
      where: { codeHash },
      select: {
        id: true,
        communityId: true,
        unitId: true,
      },
    });
    if (!invitation) {
      throw new BadRequestException(
        'This invitation code is invalid, expired, or already used',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (transaction: Prisma.TransactionClient) => {
          const now = new Date();
          const claimed = await transaction.communityInvitation.updateMany({
            where: {
              id: invitation.id,
              redeemedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { redeemedAt: now, redeemedByUserId: userId },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException(
              'This invitation code is invalid, expired, or already used',
            );
          }

          const membership = await transaction.communityMembership.create({
            data: {
              communityId: invitation.communityId,
              userId,
              status: MembershipStatus.ACTIVE,
            },
            select: {
              id: true,
              community: { select: { id: true, name: true, slug: true } },
            },
          });
          await transaction.communityMembershipRole.create({
            data: {
              communityId: invitation.communityId,
              membershipId: membership.id,
              role: CommunityRole.RESIDENT,
            },
          });
          await transaction.communityMembershipUnit.create({
            data: {
              communityId: invitation.communityId,
              membershipId: membership.id,
              unitId: invitation.unitId,
              occupancy: 'OCCUPANT',
            },
          });

          return {
            membershipId: membership.id,
            community: membership.community,
            roles: [CommunityRole.RESIDENT],
          };
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You already belong to this community and cannot use this invitation again',
        );
      }
      throw error;
    }
  }

  private hashInvitationCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private async requireActiveMembership(
    userId: string,
    communityId: string,
  ): Promise<boolean> {
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

    return membership.roles.some(
      ({ role }) => role === CommunityRole.ADMINISTRATOR,
    );
  }

  private async requireAdministrator(
    userId: string,
    communityId: string,
  ): Promise<void> {
    if (!(await this.requireActiveMembership(userId, communityId))) {
      throw new ForbiddenException(
        'Only an active community administrator can manage blocks and apartments',
      );
    }
  }
}

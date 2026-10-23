import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CommunityRole, MembershipStatus } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { COMMUNITY_ROLES_KEY } from '../auth.constants';
import { AuthenticatedUser } from '../authenticated-user';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class CommunityRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<CommunityRole[]>(
      COMMUNITY_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const communityId = request.params.communityId;

    if (typeof communityId !== 'string' || !isUUID(communityId)) {
      throw new BadRequestException(
        'A valid communityId route parameter is required',
      );
    }

    if (!request.user) {
      throw new ForbiddenException('An authenticated user is required');
    }

    const membership = await this.prisma.communityMembership.findFirst({
      where: {
        communityId,
        userId: request.user.id,
        status: MembershipStatus.ACTIVE,
        roles: { some: { role: { in: roles } } },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException(
        'An active community membership with the required role is required',
      );
    }

    return true;
  }
}

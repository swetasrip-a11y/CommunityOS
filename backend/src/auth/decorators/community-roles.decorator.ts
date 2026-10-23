import { SetMetadata } from '@nestjs/common';
import { CommunityRole } from '@prisma/client';
import { COMMUNITY_ROLES_KEY } from '../auth.constants';

export const CommunityRoles = (...roles: CommunityRole[]) =>
  SetMetadata(COMMUNITY_ROLES_KEY, roles);

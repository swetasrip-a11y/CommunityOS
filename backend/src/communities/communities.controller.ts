import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCommunityDto } from './dto/create-community.dto';
import { CreateBlockDto } from './dto/create-block.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RedeemInvitationDto } from './dto/redeem-invitation.dto';
import { UpdateSecurityRoleDto } from './dto/update-security-role.dto';
import {
  CommunitiesService,
  CommunityBlockSummary,
  CommunityInvitationSummary,
  CommunityMemberRoleSummary,
  CommunityMembershipSummary,
  CommunityStructure,
  CommunityUnitSummary,
  CreatedCommunityInvitation,
} from './communities.service';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommunityMembershipSummary[]> {
    return this.communitiesService.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityDto,
  ): Promise<CommunityMembershipSummary> {
    return this.communitiesService.createForOwner(user.id, dto);
  }

  @Post('invitations/redeem')
  redeemInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemInvitationDto,
  ): Promise<CommunityMembershipSummary> {
    return this.communitiesService.redeemInvitation(user.id, dto);
  }

  @Get(':communityId/structure')
  getStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityStructure> {
    return this.communitiesService.getStructure(user.id, communityId);
  }

  @Get(':communityId/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityMemberRoleSummary[]> {
    return this.communitiesService.listCommunityMembers(user.id, communityId);
  }

  @Patch(':communityId/members/:membershipId/security-role')
  setSecurityRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateSecurityRoleDto,
  ): Promise<CommunityMemberRoleSummary> {
    return this.communitiesService.setSecurityRole(
      user.id,
      communityId,
      membershipId,
      dto.enabled,
    );
  }

  @Post(':communityId/blocks')
  createBlock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateBlockDto,
  ): Promise<CommunityBlockSummary> {
    return this.communitiesService.createBlock(user.id, communityId, dto);
  }

  @Post(':communityId/blocks/:blockId/units')
  createUnit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: CreateUnitDto,
  ): Promise<CommunityUnitSummary> {
    return this.communitiesService.createUnit(
      user.id,
      communityId,
      blockId,
      dto,
    );
  }

  @Get(':communityId/invitations')
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<CommunityInvitationSummary[]> {
    return this.communitiesService.listInvitations(user.id, communityId);
  }

  @Post(':communityId/invitations')
  createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreatedCommunityInvitation> {
    return this.communitiesService.createInvitation(user.id, communityId, dto);
  }

  @Delete(':communityId/invitations/:invitationId')
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<{ revoked: true }> {
    return this.communitiesService.revokeInvitation(
      user.id,
      communityId,
      invitationId,
    );
  }
}

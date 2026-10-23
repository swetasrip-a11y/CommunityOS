import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateVisitorPassDto } from './dto/create-visitor-pass.dto';
import { UpdateVisitorPassStatusDto } from './dto/update-visitor-pass-status.dto';
import {
  VisitorPassSummary,
  VisitorUnitSummary,
  VisitorsService,
} from './visitors.service';

@Controller('communities/:communityId/visitor-passes')
@UseGuards(JwtAuthGuard)
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get('units')
  listMemberUnits(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<VisitorUnitSummary[]> {
    return this.visitorsService.listMemberUnits(user.id, communityId);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<VisitorPassSummary[]> {
    return this.visitorsService.listForCommunity(user.id, communityId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateVisitorPassDto,
  ): Promise<VisitorPassSummary> {
    return this.visitorsService.createForMember(user.id, communityId, dto);
  }

  @Patch(':passId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('passId', ParseUUIDPipe) passId: string,
    @Body() dto: UpdateVisitorPassStatusDto,
  ): Promise<VisitorPassSummary> {
    return this.visitorsService.updateStatus(
      user.id,
      communityId,
      passId,
      dto.status,
    );
  }
}

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
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestStatusDto } from './dto/update-service-request-status.dto';
import { RequestsService, ServiceRequestSummary } from './requests.service';

@Controller('communities/:communityId/requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<ServiceRequestSummary[]> {
    return this.requestsService.listForCommunity(user.id, communityId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateServiceRequestDto,
  ): Promise<ServiceRequestSummary> {
    return this.requestsService.createForMember(user.id, communityId, dto);
  }

  @Patch(':requestId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateServiceRequestStatusDto,
  ): Promise<ServiceRequestSummary> {
    return this.requestsService.updateStatus(
      user.id,
      communityId,
      requestId,
      dto,
    );
  }
}

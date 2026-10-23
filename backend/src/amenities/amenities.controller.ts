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
import {
  AmenitiesService,
  AmenityBookingSummary,
  AmenitySummary,
} from './amenities.service';
import { CreateAmenityBookingDto } from './dto/create-amenity-booking.dto';
import { CreateAmenityDto } from './dto/create-amenity.dto';
import { UpdateAmenityAvailabilityDto } from './dto/update-amenity-availability.dto';

@Controller('communities/:communityId/amenities')
@UseGuards(JwtAuthGuard)
export class AmenitiesController {
  constructor(private readonly amenitiesService: AmenitiesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<AmenitySummary[]> {
    return this.amenitiesService.listForCommunity(user.id, communityId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateAmenityDto,
  ): Promise<AmenitySummary> {
    return this.amenitiesService.createAmenity(user.id, communityId, dto);
  }

  @Patch(':amenityId/availability')
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('amenityId', ParseUUIDPipe) amenityId: string,
    @Body() dto: UpdateAmenityAvailabilityDto,
  ): Promise<AmenitySummary> {
    return this.amenitiesService.setAvailability(
      user.id,
      communityId,
      amenityId,
      dto.isActive,
    );
  }

  @Get('bookings')
  listBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
  ): Promise<AmenityBookingSummary[]> {
    return this.amenitiesService.listBookings(user.id, communityId);
  }

  @Post('bookings')
  createBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Body() dto: CreateAmenityBookingDto,
  ): Promise<AmenityBookingSummary> {
    return this.amenitiesService.createBooking(user.id, communityId, dto);
  }

  @Post('bookings/:bookingId/cancel')
  cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('communityId', ParseUUIDPipe) communityId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<AmenityBookingSummary> {
    return this.amenitiesService.cancelBooking(user.id, communityId, bookingId);
  }
}

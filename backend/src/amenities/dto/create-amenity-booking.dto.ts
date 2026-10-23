import { IsISO8601, IsUUID } from 'class-validator';

export class CreateAmenityBookingDto {
  @IsUUID()
  amenityId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}

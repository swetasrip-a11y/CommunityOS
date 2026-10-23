import { IsBoolean } from 'class-validator';

export class UpdateAmenityAvailabilityDto {
  @IsBoolean()
  isActive!: boolean;
}

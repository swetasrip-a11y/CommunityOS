import { ServiceRequestCategory } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateServiceRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsEnum(ServiceRequestCategory)
  category!: ServiceRequestCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

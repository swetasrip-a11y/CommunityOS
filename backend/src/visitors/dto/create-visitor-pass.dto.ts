import { VisitorPurpose } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVisitorPassDto {
  @IsString()
  @MaxLength(120)
  visitorName!: string;

  @IsUUID()
  unitId!: string;

  @IsEnum(VisitorPurpose)
  purpose!: VisitorPurpose;

  @IsISO8601()
  expectedAt!: string;
}

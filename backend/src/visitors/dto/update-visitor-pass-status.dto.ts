import { VisitorPassStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateVisitorPassStatusDto {
  @IsEnum(VisitorPassStatus)
  status!: VisitorPassStatus;
}

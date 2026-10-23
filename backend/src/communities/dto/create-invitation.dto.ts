import { IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsUUID()
  unitId!: string;
}

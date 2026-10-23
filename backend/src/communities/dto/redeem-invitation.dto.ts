import { IsString, MaxLength, MinLength } from 'class-validator';

export class RedeemInvitationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(40)
  code!: string;
}

import { IsBoolean } from 'class-validator';

export class UpdateSecurityRoleDto {
  @IsBoolean()
  enabled!: boolean;
}

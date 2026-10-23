import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateBlockDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)
  code!: string;
}

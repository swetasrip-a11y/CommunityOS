import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  number!: string;

  @IsOptional()
  @IsInt()
  @Min(-5)
  @Max(300)
  floor?: number;
}

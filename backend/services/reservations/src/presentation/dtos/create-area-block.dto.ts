import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateAreaBlockDto {
  @ApiProperty({
    description: 'Block date (YYYY-MM-DD)',
    example: '2026-04-10',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date!: string;

  @ApiProperty({
    description: 'Block start time (HH:MM)',
    example: '11:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime!: string;

  @ApiProperty({
    description: 'Block end time (HH:MM) — must be after startTime',
    example: '13:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be in HH:MM format',
  })
  endTime!: string;

  @ApiProperty({
    description: 'Reason for the block (5–500 characters)',
    example: 'Mantenimiento programado',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description:
      'When true, cancels conflicting CONFIRMED reservations and creates the block. ' +
      'When false (default), returns a conflict warning if reservations exist.',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  confirmForce?: boolean;
}

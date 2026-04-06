import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ManagerCalendarQueryDto {
  @ApiProperty({
    description: 'Date to display in the calendar (YYYY-MM-DD)',
    example: '2026-04-10',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date!: string;

  @ApiPropertyOptional({
    description: 'Filter to a specific area ULID. When omitted, returns all active areas.',
    example: '01JFAKE0000000000000000001',
  })
  @IsOptional()
  @IsString()
  areaId?: string;
}

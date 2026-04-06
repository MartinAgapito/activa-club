import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @ApiProperty({
    description: 'Date to query availability for (YYYY-MM-DD)',
    example: '2026-04-10',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date!: string;
}

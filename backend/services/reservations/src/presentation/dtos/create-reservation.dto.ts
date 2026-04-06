import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, Max, Matches } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    description: 'Area ULID to book',
    example: '01JFAKE0000000000000000001',
  })
  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @ApiProperty({
    description: 'Reservation date (YYYY-MM-DD)',
    example: '2026-04-10',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date!: string;

  @ApiProperty({
    description: 'Start time in HH:MM 24-hour format',
    example: '09:00',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime!: string;

  @ApiProperty({
    description: 'Duration in minutes (multiple of area slot duration)',
    example: 60,
    minimum: 1,
    maximum: 480,
  })
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes!: number;
}

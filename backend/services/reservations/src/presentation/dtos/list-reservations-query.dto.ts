import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListReservationsQueryDto {
  @ApiPropertyOptional({
    description:
      'View filter: "upcoming" returns CONFIRMED reservations; "history" returns CANCELLED + EXPIRED.',
    enum: ['upcoming', 'history'],
    default: 'upcoming',
  })
  @IsOptional()
  @IsString()
  @IsIn(['upcoming', 'history'])
  view?: 'upcoming' | 'history' = 'upcoming';

  @ApiPropertyOptional({
    description: 'Maximum number of items to return (1–50).',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64-encoded DynamoDB LastEvaluatedKey).',
  })
  @IsOptional()
  @IsString()
  lastKey?: string;
}

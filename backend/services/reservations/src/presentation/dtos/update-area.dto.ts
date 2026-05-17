import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Matches,
  IsArray,
  ArrayMinSize,
  IsIn,
  IsObject,
  IsOptional,
} from 'class-validator';

const MEMBERSHIPS = ['Silver', 'Gold', 'VIP'] as const;

export class UpdateAreaDto {
  @ApiPropertyOptional({ example: 'Piscina Olímpica' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  slotDuration?: number;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openingTime must be HH:MM' })
  openingTime?: string;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closingTime must be HH:MM' })
  closingTime?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancelWindowHours?: number;

  @ApiPropertyOptional({ example: ['Silver', 'Gold', 'VIP'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(MEMBERSHIPS, { each: true })
  allowedMemberships?: string[];

  @ApiPropertyOptional({ example: { Silver: 60, Gold: 90, VIP: 120 } })
  @IsOptional()
  @IsObject()
  maxDurationMinutes?: Record<string, number>;

  @ApiPropertyOptional({ example: { Silver: 3, Gold: 5, VIP: 7 } })
  @IsOptional()
  @IsObject()
  weeklyLimit?: Record<string, number>;
}

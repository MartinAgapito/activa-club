import { ApiProperty } from '@nestjs/swagger';
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
} from 'class-validator';

const MEMBERSHIPS = ['Silver', 'Gold', 'VIP'] as const;

export class CreateAreaDto {
  @ApiProperty({ example: 'Piscina' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({ example: 60, description: 'Slot duration in minutes' })
  @IsInt()
  @Min(15)
  slotDuration!: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openingTime must be HH:MM' })
  openingTime!: string;

  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closingTime must be HH:MM' })
  closingTime!: string;

  @ApiProperty({ example: 2, description: 'Hours before start within which cancellation is blocked' })
  @IsInt()
  @Min(0)
  cancelWindowHours!: number;

  @ApiProperty({ example: ['Silver', 'Gold', 'VIP'], enum: MEMBERSHIPS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(MEMBERSHIPS, { each: true })
  allowedMemberships!: string[];

  @ApiProperty({ example: { Silver: 60, Gold: 90, VIP: 120 } })
  @IsObject()
  maxDurationMinutes!: Record<string, number>;

  @ApiProperty({ example: { Silver: 3, Gold: 5, VIP: 7 } })
  @IsObject()
  weeklyLimit!: Record<string, number>;
}

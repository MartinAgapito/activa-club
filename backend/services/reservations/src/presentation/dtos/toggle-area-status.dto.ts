import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ToggleAreaStatusDto {
  @ApiProperty({ enum: ['Active', 'Inactive'] })
  @IsIn(['Active', 'Inactive'])
  status!: 'Active' | 'Inactive';
}

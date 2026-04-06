import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Request body for manager cancellation (reason is required for managers).
 * For member self-cancellation the body is empty — this DTO covers the
 * manager endpoint.
 */
export class ManagerCancelReservationDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation (required for manager, 10–500 characters)',
    example: 'Mantenimiento de emergencia en el área',
    minLength: 10,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason?: string;
}

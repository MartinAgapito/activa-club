import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for POST /v1/auth/logout — AC-008.
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: 'Confirmation message returned after a successful global sign-out.',
    example: 'Sesión cerrada correctamente',
  })
  message: string;
}

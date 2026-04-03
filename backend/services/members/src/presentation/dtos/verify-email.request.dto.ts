import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/verify-email — AC-001 Rev2 Step 2.
 */
export class VerifyEmailRequestDto {
  @ApiProperty({
    description: 'Email address used during registration. Must match exactly.',
    example: 'martin.garcia@email.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    description: 'Token de confirmación extraído del link de verificación enviado por email.',
    example: 'abc123XYZ',
  })
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  token: string;
}

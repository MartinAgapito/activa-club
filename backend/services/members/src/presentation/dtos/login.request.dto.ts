import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/login — AC-002 Step 1 / AC-010.
 *
 * Password is a string with IsNotEmpty only — Cognito enforces policy.
 * Password is never logged anywhere in the application layer.
 */
export class LoginRequestDto {
  @ApiProperty({
    description: 'Member email address. Lowercased before use.',
    example: 'martin.garcia@email.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    description: 'Member password. Validated by Cognito.',
    example: 'SecurePass1!',
  })
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  password: string;

  /**
   * AC-010: Cognito device key obtained from a previous verify-otp with rememberDevice=true.
   * When provided, Cognito will attempt device-based authentication to skip the OTP challenge.
   * If the device key is expired or unrecognized, the server returns an error — the client
   * should retry without the deviceKey to fall back to the standard OTP flow.
   */
  @ApiPropertyOptional({
    description:
      'AC-010 — Cognito device key from a previous remember-device session. ' +
      'When provided, Cognito may skip the OTP challenge for recognized devices.',
    example: 'us-east-1_abc123:device-key-uuid',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'deviceKey must be a string' })
  deviceKey?: string | null;

  @ApiPropertyOptional({
    description: 'AC-010 — Device group key returned by verify-otp. Required alongside deviceKey.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  deviceGroupKey?: string | null;

  @ApiPropertyOptional({
    description: 'AC-010 — Device password returned by verify-otp. Required for SRP handshake.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  devicePassword?: string | null;
}

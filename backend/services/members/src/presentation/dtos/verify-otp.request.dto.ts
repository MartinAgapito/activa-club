import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for POST /v1/auth/verify-otp — AC-002 Step 2 / AC-010.
 */
export class VerifyOtpRequestDto {
  @ApiProperty({
    description: 'Must match the email used in POST /v1/auth/login.',
    example: 'martin.garcia@email.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    description: 'Opaque session token returned by POST /v1/auth/login. Valid for 3 minutes.',
    example: 'AYABeH...',
  })
  @IsString()
  @IsNotEmpty({ message: 'session is required' })
  session: string;

  @ApiProperty({
    description: "The 6-digit numeric OTP sent by Cognito to the member's email.",
    example: '482917',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'otp is required' })
  @Length(6, 6, { message: 'otp must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 numeric digits' })
  otp: string;

  /**
   * AC-010: Accepted for backwards compatibility but has no effect on the backend.
   * Session persistence is handled via the refresh token returned in the response.
   */
  @ApiPropertyOptional({
    description:
      'AC-010 — Accepted for backwards compatibility. Session persistence is handled ' +
      'via the refresh token (POST /v1/auth/refresh). No device registration is performed.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'rememberDevice must be a boolean' })
  rememberDevice?: boolean;
}

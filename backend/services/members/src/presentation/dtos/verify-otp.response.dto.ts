import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data portion of the OTP verification success response.
 */
export class VerifyOtpDataDto {
  @ApiProperty({
    description: 'Cognito Access Token. Valid for 60 minutes.',
    example: 'eyJraWQiOiJ...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Cognito ID Token containing user claims. Valid for 60 minutes.',
    example: 'eyJraWQiOiJ...',
  })
  idToken: string;

  @ApiProperty({
    description: 'Cognito Refresh Token. Valid for 30 days.',
    example: 'eyJjdHkiOiJ...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Token TTL in seconds.',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Token type for use in Authorization header.',
    example: 'Bearer',
  })
  tokenType: string;

  /**
   * AC-010: Cognito device key returned when rememberDevice=true and ConfirmDevice succeeded.
   * The client must persist this key (e.g., localStorage or secure storage) and include it
   * in subsequent login requests to skip the OTP challenge on this device.
   * Null when rememberDevice was false or NewDeviceMetadata was absent.
   */
  @ApiPropertyOptional({
    description:
      'AC-010 — Cognito device key. Present when rememberDevice=true was requested and the device was successfully registered. ' +
      'Persist this value and include it as deviceKey in future POST /v1/auth/login requests to skip OTP.',
    example: 'us-east-1_abc123:device-key-uuid',
    nullable: true,
  })
  deviceKey: string | null;
}

/**
 * Response DTO for POST /v1/auth/verify-otp — HTTP 200.
 *
 * Returned after a successful OTP challenge response.
 * Tokens must be stored in memory or httpOnly cookies — never localStorage.
 */
export class VerifyOtpResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: VerifyOtpDataDto })
  data: VerifyOtpDataDto;
}

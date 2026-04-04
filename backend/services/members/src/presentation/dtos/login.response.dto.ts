import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data portion of the login step 1 success response.
 *
 * When challengeName is 'EMAIL_OTP', session is populated and the client
 * must call POST /v1/auth/verify-otp to complete authentication.
 *
 * AC-010: when challengeName is null, a trusted device bypassed the OTP step.
 * In this case accessToken, idToken, refreshToken, and expiresIn are populated
 * and the login is complete — no further action needed.
 */
export class LoginDataDto {
  @ApiPropertyOptional({
    description:
      'Cognito challenge name. EMAIL_OTP when OTP is required. ' +
      'Null when AC-010 device bypass succeeded and tokens are returned directly.',
    example: 'EMAIL_OTP',
    nullable: true,
  })
  challengeName: string | null;

  @ApiPropertyOptional({
    description:
      'Opaque Cognito session token. Valid for 3 minutes. Must be included in the verify-otp request. ' +
      'Null when device bypass succeeded.',
    example: 'AYABeH...',
    nullable: true,
  })
  session: string | null;

  @ApiProperty({
    description: 'Instruction message for the member.',
    example: 'A verification code has been sent to your email.',
  })
  message: string;

  /**
   * AC-010: Access token returned when device bypass succeeds (challengeName is null).
   * Null in the standard EMAIL_OTP flow.
   */
  @ApiPropertyOptional({
    description: 'AC-010 — Cognito Access Token. Present only when device bypass succeeded.',
    example: 'eyJraWQiOiJ...',
    nullable: true,
  })
  accessToken: string | null;

  /**
   * AC-010: ID token returned when device bypass succeeds.
   * Null in the standard EMAIL_OTP flow.
   */
  @ApiPropertyOptional({
    description: 'AC-010 — Cognito ID Token. Present only when device bypass succeeded.',
    example: 'eyJraWQiOiJ...',
    nullable: true,
  })
  idToken: string | null;

  /**
   * AC-010: Refresh token returned when device bypass succeeds.
   * Null in the standard EMAIL_OTP flow.
   */
  @ApiPropertyOptional({
    description: 'AC-010 — Cognito Refresh Token. Present only when device bypass succeeded.',
    example: 'eyJjdHkiOiJ...',
    nullable: true,
  })
  refreshToken: string | null;

  /**
   * AC-010: Token TTL in seconds when device bypass succeeds.
   * Null in the standard EMAIL_OTP flow.
   */
  @ApiPropertyOptional({
    description: 'AC-010 — Token TTL in seconds. Present only when device bypass succeeded.',
    example: 3600,
    nullable: true,
  })
  expiresIn: number | null;
}

/**
 * Response DTO for POST /v1/auth/login — HTTP 200.
 *
 * HTTP 200 with challengeName=EMAIL_OTP signals that credentials are valid
 * and the member must now submit the OTP sent to their email.
 *
 * HTTP 200 with challengeName=null (AC-010) signals that a trusted device
 * bypassed the OTP challenge and full tokens are returned.
 */
export class LoginResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;
}

import { ApiProperty } from '@nestjs/swagger';

/**
 * Data portion of the login step 1 success response.
 */
export class LoginDataDto {
  @ApiProperty({
    description: 'Cognito challenge name. Always EMAIL_OTP when MFA is ON.',
    example: 'EMAIL_OTP',
  })
  challengeName: string;

  @ApiProperty({
    description:
      'Opaque Cognito session token. Valid for 3 minutes. Must be included in the verify-otp request.',
    example: 'AYABeH...',
  })
  session: string;

  @ApiProperty({
    description: 'Instruction message for the member.',
    example: 'A verification code has been sent to your email.',
  })
  message: string;
}

/**
 * Response DTO for POST /v1/auth/login — HTTP 200.
 *
 * HTTP 200 with an EMAIL_OTP challenge signals that credentials are valid
 * and the member must now submit the OTP sent to their email.
 */
export class LoginResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;
}

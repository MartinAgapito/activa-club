import { ApiProperty } from '@nestjs/swagger';

/**
 * Data portion of the registration accepted response — AC-001 Rev2.
 */
export class RegisterMemberDataDto {
  @ApiProperty({
    description: 'Email address to which the verification code was sent.',
    example: 'martin.garcia@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'Instruction message for the member.',
    example:
      'A verification code has been sent to your email. Please enter it to activate your account.',
  })
  message: string;
}

/**
 * Response DTO for POST /v1/auth/register — HTTP 202 (Accepted).
 *
 * HTTP 202 signals that the registration is pending email OTP verification.
 * The account does not exist in MembersTable yet — only an UNCONFIRMED
 * Cognito user was created.
 */
export class RegisterMemberResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: RegisterMemberDataDto })
  data: RegisterMemberDataDto;
}

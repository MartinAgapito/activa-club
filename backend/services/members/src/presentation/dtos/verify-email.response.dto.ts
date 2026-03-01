import { ApiProperty } from '@nestjs/swagger';
import { MembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';

/**
 * Data portion of the email verification success response.
 */
export class VerifyEmailDataDto {
  @ApiProperty({
    description: 'ULID identifier of the newly activated member.',
    example: '01JKZP7QR8S9T0UVWX1YZ2AB3C',
  })
  member_id: string;

  @ApiProperty({
    description: 'Full name inherited from the seed record.',
    example: 'Martin Garcia',
  })
  full_name: string;

  @ApiProperty({
    description: 'Email address of the activated member.',
    example: 'martin.garcia@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'Membership tier inherited from the seed record.',
    enum: MembershipType,
    example: MembershipType.GOLD,
  })
  membership_type: MembershipType;

  @ApiProperty({
    description: 'Current account status.',
    enum: AccountStatus,
    example: AccountStatus.ACTIVE,
  })
  account_status: AccountStatus;

  @ApiProperty({
    description: 'ISO-8601 UTC timestamp of account creation.',
    example: '2026-02-27T15:30:00.000Z',
  })
  created_at: string;
}

/**
 * Response DTO for POST /v1/auth/verify-email — HTTP 201 (Created).
 *
 * Returned after the OTP is confirmed and the member profile has been
 * persisted in DynamoDB MembersTable.
 */
export class VerifyEmailResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: VerifyEmailDataDto })
  data: VerifyEmailDataDto;

  @ApiProperty({
    example: 'Account successfully activated. You can now sign in.',
  })
  message: string;
}

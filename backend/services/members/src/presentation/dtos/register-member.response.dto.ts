import { ApiProperty } from '@nestjs/swagger';
import { MembershipType } from '../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../domain/value-objects/account-status.vo';

/**
 * Data portion of the registration success response.
 */
export class RegisterMemberDataDto {
  @ApiProperty({
    description: 'ULID identifier of the newly registered member.',
    example: '01JKZP7QR8S9T0UVWX1YZ2AB3C',
  })
  member_id: string;

  @ApiProperty({
    description: 'Full name of the registered member.',
    example: 'Martin Garcia',
  })
  full_name: string;

  @ApiProperty({
    description: 'Email address of the registered member.',
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
    description: 'ISO-8601 UTC timestamp of registration.',
    example: '2026-02-20T15:30:00.000Z',
  })
  created_at: string;
}

/**
 * Response DTO for POST /v1/auth/register — HTTP 201.
 */
export class RegisterMemberResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ type: RegisterMemberDataDto })
  data: RegisterMemberDataDto;

  @ApiProperty({
    example:
      'Registration successful. Please check your email to confirm your account.',
  })
  message: string;
}

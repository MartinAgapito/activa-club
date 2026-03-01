import { MemberEntity } from '../../../domain/entities/member.entity';
import { MembershipType } from '../../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../../domain/value-objects/account-status.vo';

/**
 * Verify email result — AC-001 Rev2 Step 2.
 *
 * Encapsulates data returned by VerifyEmailHandler after the member profile
 * has been created in DynamoDB. Represents the HTTP 201 response payload.
 */
export class VerifyEmailResult {
  readonly memberId: string;
  readonly fullName: string;
  readonly email: string;
  readonly membershipType: MembershipType;
  readonly accountStatus: AccountStatus;
  readonly createdAt: string;

  constructor(member: MemberEntity) {
    this.memberId = member.memberId;
    this.fullName = member.fullName;
    this.email = member.email;
    this.membershipType = member.membershipType;
    this.accountStatus = member.accountStatus;
    this.createdAt = member.createdAt;
  }
}

import { MemberEntity } from '../../../domain/entities/member.entity';
import { MembershipType } from '../../../domain/value-objects/membership-type.vo';
import { AccountStatus } from '../../../domain/value-objects/account-status.vo';

/**
 * Register member result.
 *
 * Encapsulates the data returned by the RegisterMemberHandler to the
 * presentation layer. Contains only the fields required by the API contract.
 */
export class RegisterMemberResult {
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

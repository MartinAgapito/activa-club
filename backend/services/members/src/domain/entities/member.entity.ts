import { MembershipType } from '../value-objects/membership-type.vo';
import { AccountStatus } from '../value-objects/account-status.vo';

export interface MemberEntityProps {
  memberId: string;
  dni: string;
  fullName: string;
  email: string;
  phone?: string;
  membershipType: MembershipType;
  accountStatus: AccountStatus;
  cognitoUserId: string;
  createdAt: string;
  updatedAt: string;
  membershipExpiry?: string;
}

/**
 * Member domain entity.
 *
 * Represents a registered club member. This class contains only domain state
 * and behaviour — no NestJS or AWS SDK dependencies.
 */
export class MemberEntity {
  readonly memberId: string;
  readonly dni: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone?: string;
  readonly membershipType: MembershipType;
  readonly accountStatus: AccountStatus;
  readonly cognitoUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly membershipExpiry?: string;

  constructor(props: MemberEntityProps) {
    this.memberId = props.memberId;
    this.dni = props.dni;
    this.fullName = props.fullName;
    this.email = props.email;
    this.phone = props.phone;
    this.membershipType = props.membershipType;
    this.accountStatus = props.accountStatus;
    this.cognitoUserId = props.cognitoUserId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.membershipExpiry = props.membershipExpiry;
  }

  isActive(): boolean {
    return this.accountStatus === AccountStatus.ACTIVE;
  }
}

/**
 * MemberProfile domain entity (read-only projection for reservations context).
 *
 * Contains only the attributes needed by the reservations bounded context.
 * Does not duplicate the full MemberEntity from the members service.
 *
 * AC-011
 */
export interface MemberProfileEntityProps {
  memberId: string;
  cognitoUserId: string;
  membershipType: string;
  accountStatus: string;
  weeklyReservationCount: number;
  weeklyResetAt: string; // ISO-8601
}

export class MemberProfileEntity {
  readonly memberId: string;
  readonly cognitoUserId: string;
  readonly membershipType: string;
  readonly accountStatus: string;
  readonly weeklyReservationCount: number;
  readonly weeklyResetAt: string;

  constructor(props: MemberProfileEntityProps) {
    this.memberId = props.memberId;
    this.cognitoUserId = props.cognitoUserId;
    this.membershipType = props.membershipType;
    this.accountStatus = props.accountStatus;
    this.weeklyReservationCount = props.weeklyReservationCount;
    this.weeklyResetAt = props.weeklyResetAt;
  }

  isActive(): boolean {
    return this.accountStatus === 'active';
  }
}

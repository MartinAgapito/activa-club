export const MEMBERS_REPOSITORY = Symbol('MembersRepositoryInterface');

/**
 * Minimal member record needed by the reservations service.
 * Maps to the MembersTable schema (subset of fields).
 */
export interface MemberRecord {
  pk: string;
  memberId: string;
  membershipType: string;
  accountStatus: string;
  weeklyReservationCount: number;
  weeklyResetAt: string;
  cognitoUserId: string;
}

/**
 * Port interface for reading member data from the MembersTable.
 *
 * The application layer uses this port — the infrastructure layer provides
 * a DynamoDB implementation.
 */
export interface MembersRepositoryInterface {
  /** Look up a member by their internal memberId (DynamoDB PK). */
  findById(memberId: string): Promise<MemberRecord | null>;

  /** Look up a member by their Cognito sub (GSI_CognitoSub). */
  findByCognitoSub(cognitoSub: string): Promise<MemberRecord | null>;
}

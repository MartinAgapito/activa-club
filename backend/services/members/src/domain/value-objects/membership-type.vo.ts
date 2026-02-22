/**
 * Membership tier value object.
 *
 * Represents the tier of a club membership, inherited from the seed record
 * at registration time. Cannot be changed by the member directly.
 */
export enum MembershipType {
  VIP = 'VIP',
  GOLD = 'Gold',
  SILVER = 'Silver',
}

export function isMembershipType(value: string): value is MembershipType {
  return Object.values(MembershipType).includes(value as MembershipType);
}

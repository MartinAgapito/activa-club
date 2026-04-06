/**
 * MembershipRules value object.
 *
 * Holds the per-membership-type restrictions for a given area:
 *   - maxDurationMinutes: maximum reservation duration
 *   - weeklyLimit: maximum reservations per ISO week
 *   - allowedMemberships: membership types that may book this area
 */
export class MembershipRules {
  readonly maxDurationMinutes: number;
  readonly weeklyLimit: number;
  readonly allowedMemberships: string[];

  constructor(maxDurationMinutes: number, weeklyLimit: number, allowedMemberships: string[]) {
    this.maxDurationMinutes = maxDurationMinutes;
    this.weeklyLimit = weeklyLimit;
    this.allowedMemberships = allowedMemberships;
  }
}

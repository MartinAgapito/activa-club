import { MembershipType } from '../value-objects/membership-type.vo';
import { AccountStatus } from '../value-objects/account-status.vo';

/**
 * Seed member record — reflects the shape of an item in SeedMembersTable.
 */
export interface SeedMemberRecord {
  pk: string;
  dni: string;
  fullName: string;
  membershipType: MembershipType;
  accountStatus: AccountStatus;
  email?: string;
  phone?: string;
  importedAt: string;
}

/**
 * Seed member repository port.
 *
 * Read-only access to SeedMembersTable (pre-loaded legacy data).
 * No write operations are permitted from the application layer.
 */
export interface SeedMemberRepositoryInterface {
  /**
   * Retrieves the seed record for the given DNI.
   * Returns null when the DNI is not present in the seed table.
   */
  findByDni(dni: string): Promise<SeedMemberRecord | null>;
}

export const SEED_MEMBER_REPOSITORY = Symbol('SeedMemberRepositoryInterface');

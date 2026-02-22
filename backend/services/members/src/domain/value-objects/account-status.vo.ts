/**
 * Account status value object.
 *
 * Represents the lifecycle state of a member account.
 *   active    — full access to the platform
 *   inactive  — blocked at seed level; cannot register
 *   suspended — access revoked by admin after registration
 */
export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export function isAccountStatus(value: string): value is AccountStatus {
  return Object.values(AccountStatus).includes(value as AccountStatus);
}

import { SetMetadata } from '@nestjs/common';

/**
 * Cognito groups supported by the ActivaClub platform.
 */
export type UserRole = 'Admin' | 'Manager' | 'Member';

export const ROLES_KEY = 'roles';

/**
 * @Roles decorator — attach to a controller or route handler to restrict
 * access to users who belong to at least one of the specified Cognito groups.
 *
 * @example
 * @Roles('Admin', 'Manager')
 * @Get()
 * findAll() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { Request } from 'express';

/**
 * Roles-based access control guard.
 *
 * Reads the required roles from the @Roles() decorator metadata and compares
 * them against the Cognito groups present in the validated JWT payload.
 *
 * Must be used AFTER JwtAuthGuard (user must be authenticated first).
 *
 * The Cognito JWT contains a `cognito:groups` claim with an array of group names.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access to authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userGroups: string[] = user['cognito:groups'] ?? [];

    const hasRole = requiredRoles.some((role) => userGroups.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required roles: [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}

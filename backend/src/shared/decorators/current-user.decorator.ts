import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  'cognito:groups': string[];
  'cognito:username': string;
}

/**
 * @CurrentUser parameter decorator.
 *
 * Extracts the authenticated user from the request object (populated by
 * JwtAuthGuard / Passport after JWT validation).
 *
 * @example
 * @Get('me')
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);

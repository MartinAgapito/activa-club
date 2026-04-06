import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * Metadata key for the @Roles() decorator.
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator — attach to a controller method to restrict access.
 *
 * @example
 * @Roles('Admin', 'Manager')
 */
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * CognitoJwtPayload — minimal shape of the decoded Cognito JWT.
 *
 * API Gateway Cognito Authorizer injects these claims into the request context
 * as `event.requestContext.authorizer.jwt.claims`.
 * In local dev (NestJS HTTP), they appear on `req.user` after passport-jwt decoding.
 */
export interface CognitoJwtPayload {
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
  'custom:memberId'?: string;
  'custom:membershipType'?: string;
}

/**
 * RolesGuard — enforces role-based access using Cognito JWT claims.
 *
 * Reads the required roles from @Roles() metadata and compares them against
 * the `cognito:groups` claim on the decoded JWT token.
 *
 * Token injection: The guard expects either:
 *   (a) `req.user` set by a JwtStrategy (local dev with passport-jwt), OR
 *   (b) API Gateway Lambda Proxy event claims accessible via
 *       `req.apiGateway?.event?.requestContext?.authorizer?.jwt?.claims`
 *
 * For simplicity in this service, we read from the Authorization header and
 * decode the JWT payload (without verification — verification is done by
 * API Gateway Cognito Authorizer before the Lambda is invoked).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());

    // If no @Roles() decorator is present, allow all authenticated callers
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const payload = extractCognitoPayload(request);

    if (!payload) {
      throw new UnauthorizedException('Missing or invalid Authorization token');
    }

    const groups: string[] = payload['cognito:groups'] ?? [];
    const hasRole = requiredRoles.some((role) => groups.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    // Attach decoded payload to request for downstream use
    (request as any).cognitoUser = payload;

    return true;
  }
}

/**
 * Extracts and base64-decodes the JWT payload from the Authorization header.
 * Note: signature verification is done by API Gateway — this is safe.
 */
export function extractCognitoPayload(request: Request): CognitoJwtPayload | null {
  // 1. Try req.user (passport-jwt local dev)
  if ((request as any).user) {
    return (request as any).user as CognitoJwtPayload;
  }

  // 2. Try Authorization header (Lambda production path)
  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadJson) as CognitoJwtPayload;
  } catch {
    return null;
  }
}

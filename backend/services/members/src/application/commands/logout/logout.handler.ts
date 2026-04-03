import { Injectable, Logger } from '@nestjs/common';
import { LogoutCommand } from './logout.command';
import { LogoutResult } from './logout.result';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import {
  InvalidTokenException,
  LogoutFailedException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Logout handler (use case) — AC-008.
 *
 * Signs the member out of all Cognito sessions globally using
 * AdminUserGlobalSignOut. The username is extracted from the JWT payload
 * via Base64 decode — no cryptographic verification is needed here because
 * the endpoint is protected by the JWT guard, which already validated the
 * signature before this handler is called.
 *
 * Exception mapping:
 *   - Malformed token (cannot decode payload)  → InvalidTokenException (401)
 *   - Cognito UserNotFoundException             → InvalidTokenException (401)
 *   - Any other Cognito error                  → LogoutFailedException (500)
 *
 * Security: the access token is NEVER logged.
 */
@Injectable()
export class LogoutHandler {
  private readonly logger = new Logger(LogoutHandler.name);

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: LogoutCommand): Promise<LogoutResult> {
    const username = this.extractUsernameFromToken(command.accessToken);

    this.logger.log(`LogoutHandler: signing out username=${username}`);

    try {
      await this.cognitoService.adminUserGlobalSignOut(username);
    } catch (error) {
      this.mapSignOutError(error);
      throw error;
    }

    this.logger.log(`LogoutHandler: global sign-out successful for username=${username}`);

    return new LogoutResult({ message: 'Sesión cerrada correctamente' });
  }

  /**
   * Decodes the JWT payload (middle segment) without verifying the signature.
   * The guard has already verified the signature before this handler executes.
   *
   * Extracts the `username` claim (Cognito uses `username` or `cognito:username`).
   *
   * @throws InvalidTokenException if the token is malformed or has no username claim.
   */
  private extractUsernameFromToken(token: string): string {
    try {
      const segments = token.split('.');
      if (segments.length !== 3) {
        throw new Error('Not a valid JWT structure');
      }

      const payload = segments[1];
      // Restore standard Base64 from URL-safe Base64 and pad to multiple of 4
      const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
      const json = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf-8',
      );
      const claims = JSON.parse(json) as Record<string, unknown>;

      // Cognito access tokens use `username`; id tokens use `cognito:username`
      const username =
        (claims['username'] as string | undefined) ??
        (claims['cognito:username'] as string | undefined) ??
        (claims['sub'] as string | undefined);

      if (!username) {
        throw new Error('No username claim found in token payload');
      }

      return username;
    } catch {
      throw new InvalidTokenException();
    }
  }

  /**
   * Maps Cognito SDK exception names to domain exceptions.
   */
  private mapSignOutError(error: unknown): never | void {
    if (!(error instanceof Error)) return;

    switch (error.name) {
      case 'UserNotFoundException':
        // Token references a user that no longer exists in Cognito
        throw new InvalidTokenException();

      case 'NotAuthorizedException':
        // Token is not authorized to sign out (already signed out or revoked)
        throw new InvalidTokenException();

      default:
        throw new LogoutFailedException();
    }
  }
}

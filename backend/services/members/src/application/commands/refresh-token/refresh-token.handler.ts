import { Injectable, Logger } from '@nestjs/common';
import { RefreshTokenCommand } from './refresh-token.command';
import { RefreshTokenResult } from './refresh-token.result';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import {
  InvalidTokenException,
  SessionExpiredException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Refresh token handler — AC-010 (token-based session persistence).
 *
 * Exchanges a Cognito refresh token for new access + id tokens.
 * Used by the frontend to silently re-authenticate without requiring
 * the user to enter credentials or OTP again.
 *
 * Exception mapping:
 *   - NotAuthorizedException → InvalidTokenException (401) — refresh token expired or revoked
 *   - UserNotFoundException  → SessionExpiredException (410) — user deleted
 *   - Any other error        → re-thrown as-is
 */
@Injectable()
export class RefreshTokenHandler {
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    this.logger.log('RefreshTokenHandler: exchanging refresh token');

    try {
      const result = await this.cognitoService.refreshTokens(command.refreshToken);
      this.logger.log('RefreshTokenHandler: tokens refreshed successfully');
      return result;
    } catch (error) {
      this.logger.error('RefreshTokenHandler: failed to refresh token', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });
      this.mapRefreshError(error);
      throw error;
    }
  }

  private mapRefreshError(error: unknown): never | void {
    if (!(error instanceof Error)) return;

    switch (error.name) {
      case 'NotAuthorizedException':
        throw new InvalidTokenException();

      case 'UserNotFoundException':
        throw new SessionExpiredException();
    }
  }
}

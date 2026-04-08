/**
 * Refresh token command — AC-010 (refresh token approach).
 *
 * Exchanges a stored Cognito refresh token for new access/id tokens.
 * Allows the client to stay logged in without re-entering credentials.
 */
export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

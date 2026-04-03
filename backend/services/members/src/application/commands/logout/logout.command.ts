/**
 * Logout command — AC-008.
 *
 * Carries the raw access token from the presentation layer to LogoutHandler.
 * The handler extracts the username from the token payload via Base64 decode
 * (no cryptographic verification needed — Cognito AdminUserGlobalSignOut
 * accepts the username directly).
 *
 * Token must NEVER be logged.
 */
export class LogoutCommand {
  constructor(public readonly accessToken: string) {}
}

/**
 * Login command — AC-002 Step 1 / AC-010.
 *
 * Carries validated credentials from the presentation layer to LoginHandler.
 * No decorators or framework dependencies.
 * Password is never logged.
 *
 * AC-010: deviceKey is optional. When provided, it is included in AdminInitiateAuth
 * so Cognito can attempt device-based authentication and potentially skip the OTP challenge.
 */
export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    /** AC-010: Cognito device key from a previous remember-device session. */
    public readonly deviceKey?: string | null,
  ) {}
}

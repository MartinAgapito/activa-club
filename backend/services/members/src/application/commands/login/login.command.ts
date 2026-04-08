/**
 * Login command — AC-002 Step 1.
 *
 * AC-010 session persistence uses refresh tokens (POST /v1/auth/refresh),
 * not device credentials at the login step.
 */
export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

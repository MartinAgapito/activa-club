/**
 * Register member result — AC-001 Rev2.
 *
 * Returned by RegisterMemberHandler after a successful Cognito SignUp.
 * The response is HTTP 202 (Accepted) — the account is in UNCONFIRMED state
 * pending email OTP verification via POST /v1/auth/verify-email.
 */
export class RegisterMemberResult {
  /** The email address to which the OTP was sent. */
  readonly email: string;

  constructor(email: string) {
    this.email = email;
  }
}

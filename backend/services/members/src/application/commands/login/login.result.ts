/**
 * Login result — AC-002 Step 1.
 *
 * Contains the EMAIL_OTP challenge name and the opaque Cognito session token.
 * The session token is valid for 3 minutes and must be passed to verify-otp.
 */
export class LoginResult {
  readonly challengeName: string;
  readonly session: string;

  constructor(params: { challengeName: string; session: string }) {
    this.challengeName = params.challengeName;
    this.session = params.session;
  }
}

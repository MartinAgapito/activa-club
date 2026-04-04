/**
 * Login result — AC-002 Step 1 / AC-010.
 *
 * Contains the challenge name and session token for the OTP flow,
 * or the full token set when a trusted device bypasses the OTP challenge.
 *
 * When challengeName is null, the login is complete (device bypass succeeded)
 * and the accessToken, idToken, and refreshToken fields are populated.
 * When challengeName is 'EMAIL_OTP', the session field is populated and the
 * client must call verify-otp to complete the flow.
 */
export class LoginResult {
  /** Challenge name returned by Cognito. Null when device bypass succeeds. */
  readonly challengeName: string | null;
  /** Opaque Cognito session token. Populated when challengeName is EMAIL_OTP. */
  readonly session: string | null;
  /** AC-010: Access token returned when device bypass succeeds. */
  readonly accessToken: string | null;
  /** AC-010: ID token returned when device bypass succeeds. */
  readonly idToken: string | null;
  /** AC-010: Refresh token returned when device bypass succeeds. */
  readonly refreshToken: string | null;
  /** AC-010: Token TTL in seconds. Present when device bypass succeeds. */
  readonly expiresIn: number | null;

  constructor(params: {
    challengeName: string | null;
    session?: string | null;
    accessToken?: string | null;
    idToken?: string | null;
    refreshToken?: string | null;
    expiresIn?: number | null;
  }) {
    this.challengeName = params.challengeName;
    this.session = params.session ?? null;
    this.accessToken = params.accessToken ?? null;
    this.idToken = params.idToken ?? null;
    this.refreshToken = params.refreshToken ?? null;
    this.expiresIn = params.expiresIn ?? null;
  }
}

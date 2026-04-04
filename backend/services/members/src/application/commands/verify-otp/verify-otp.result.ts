/**
 * Verify OTP result — AC-002 Step 2 / AC-010.
 *
 * Contains the Cognito tokens returned after a successful OTP challenge response.
 * When rememberDevice was requested and ConfirmDevice succeeded, deviceKey holds
 * the Cognito device key the client should persist for future logins.
 * Tokens must NEVER be logged.
 */
export class VerifyOtpResult {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
  /** AC-010: Cognito device key. Null when rememberDevice was false or ConfirmDevice was skipped. */
  readonly deviceKey: string | null;

  constructor(params: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    deviceKey?: string | null;
  }) {
    this.accessToken = params.accessToken;
    this.idToken = params.idToken;
    this.refreshToken = params.refreshToken;
    this.expiresIn = params.expiresIn;
    this.tokenType = params.tokenType;
    this.deviceKey = params.deviceKey ?? null;
  }
}

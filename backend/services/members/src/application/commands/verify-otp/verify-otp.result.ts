/**
 * Verify OTP result — AC-002 Step 2 / AC-010.
 *
 * Contains the Cognito tokens returned after a successful OTP challenge response.
 * AC-010 session persistence is handled via the refresh token stored by the client.
 * Tokens must NEVER be logged.
 */
export class VerifyOtpResult {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;

  constructor(params: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }) {
    this.accessToken = params.accessToken;
    this.idToken = params.idToken;
    this.refreshToken = params.refreshToken;
    this.expiresIn = params.expiresIn;
    this.tokenType = params.tokenType;
  }
}

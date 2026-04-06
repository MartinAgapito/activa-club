/**
 * Verify OTP result — AC-002 Step 2 / AC-010.
 *
 * Contains the Cognito tokens returned after a successful OTP challenge response.
 * When rememberDevice was requested and ConfirmDevice succeeded, deviceKey,
 * deviceGroupKey, and devicePassword must all be persisted client-side to complete
 * the DEVICE_SRP_AUTH handshake on future logins. Tokens must NEVER be logged.
 */
export class VerifyOtpResult {
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
  /** AC-010: Cognito device key. Null when rememberDevice was false or ConfirmDevice was skipped. */
  readonly deviceKey: string | null;
  /** AC-010: Cognito device group key — required for DEVICE_SRP_AUTH handshake. */
  readonly deviceGroupKey: string | null;
  /** AC-010: Random device password used during ConfirmDevice — required for DEVICE_SRP_AUTH handshake. */
  readonly devicePassword: string | null;

  constructor(params: {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    deviceKey?: string | null;
    deviceGroupKey?: string | null;
    devicePassword?: string | null;
  }) {
    this.accessToken = params.accessToken;
    this.idToken = params.idToken;
    this.refreshToken = params.refreshToken;
    this.expiresIn = params.expiresIn;
    this.tokenType = params.tokenType;
    this.deviceKey = params.deviceKey ?? null;
    this.deviceGroupKey = params.deviceGroupKey ?? null;
    this.devicePassword = params.devicePassword ?? null;
  }
}

/**
 * Verify OTP command — AC-002 Step 2.
 *
 * Carries the email, Cognito session token, and OTP code from the
 * presentation layer to VerifyOtpHandler.
 * No decorators or framework dependencies.
 */
export class VerifyOtpCommand {
  constructor(
    public readonly email: string,
    public readonly session: string,
    public readonly otp: string,
  ) {}
}

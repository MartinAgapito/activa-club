/**
 * Verify OTP command — AC-002 Step 2 / AC-010.
 *
 * Carries the email, Cognito session token, OTP code, and optional
 * rememberDevice flag from the presentation layer to VerifyOtpHandler.
 * No decorators or framework dependencies.
 */
export class VerifyOtpCommand {
  constructor(
    public readonly email: string,
    public readonly session: string,
    public readonly otp: string,
    /** AC-010: when true, the handler will call ConfirmDevice after successful auth. */
    public readonly rememberDevice: boolean = false,
  ) {}
}

/**
 * Resend code command — AC-001 Rev2.
 *
 * Carries the email address for which a new OTP should be sent.
 * No decorators or framework dependencies.
 */
export class ResendCodeCommand {
  constructor(public readonly email: string) {}
}

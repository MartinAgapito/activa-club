/**
 * Verify email command — AC-001 Rev2 Step 2.
 *
 * Carries validated input from the presentation layer to VerifyEmailHandler.
 * No decorators or framework dependencies.
 */
export class VerifyEmailCommand {
  constructor(
    public readonly email: string,
    public readonly token: string,
  ) {}
}

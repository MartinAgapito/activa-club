/**
 * Login command — AC-002 Step 1.
 *
 * Carries validated credentials from the presentation layer to LoginHandler.
 * No decorators or framework dependencies.
 * Password is never logged.
 */
export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

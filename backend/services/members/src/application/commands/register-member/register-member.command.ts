/**
 * Register member command.
 *
 * Plain data object carrying validated input from the presentation layer
 * to the use case handler. No decorators or framework dependencies.
 */
export class RegisterMemberCommand {
  constructor(
    public readonly dni: string,
    public readonly email: string,
    public readonly password: string,
    public readonly fullName?: string,
    public readonly phone?: string,
  ) {}
}

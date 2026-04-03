/**
 * Logout result — AC-008.
 *
 * Simple value object returned by LogoutHandler on success.
 */
export class LogoutResult {
  readonly message: string;

  constructor(params: { message: string }) {
    this.message = params.message;
  }
}

/**
 * Result returned by RefreshTokenHandler on success.
 */
export class RefreshTokenResult {
  constructor(
    public readonly accessToken: string,
    public readonly idToken: string,
    public readonly expiresIn: number,
    public readonly tokenType: string,
  ) {}
}

/**
 * Login command — AC-002 Step 1 / AC-010.
 *
 * AC-010: deviceKey, deviceGroupKey, and devicePassword are all required to
 * complete the DEVICE_SRP_AUTH two-round handshake with Cognito. The client
 * must persist and send all three values that were returned by verify-otp.
 */
export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    /** AC-010: Cognito device key from a previous remember-device session. */
    public readonly deviceKey?: string | null,
    /** AC-010: Cognito device group key — required for DEVICE_SRP_AUTH SRP computation. */
    public readonly deviceGroupKey?: string | null,
    /** AC-010: Random device password from ConfirmDevice — required for DEVICE_SRP_AUTH. */
    public readonly devicePassword?: string | null,
  ) {}
}

import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { VerifyOtpCommand } from './verify-otp.command';
import { VerifyOtpResult } from './verify-otp.result';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import { generateDeviceSrpVerifier } from '../../../infrastructure/cognito/device-srp.helper';
import {
  InvalidOtpException,
  SessionExpiredException,
  TooManyAttemptsException,
  DeviceConfirmationFailedException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Verify OTP handler (use case) — AC-002 Step 2 / AC-010.
 *
 * Responds to the Cognito EMAIL_OTP challenge with the code submitted by the member.
 * On success, Cognito returns AccessToken, IdToken, and RefreshToken.
 *
 * AC-010 extension: when rememberDevice=true and Cognito returns NewDeviceMetadata,
 * this handler:
 *   1. Generates a random device password (32 bytes hex).
 *   2. Computes the SRP verifier and salt for the device.
 *   3. Calls CognitoService.confirmDevice to register the device.
 *   4. Returns the deviceKey in the result so the client can persist it.
 *
 * Exception mapping from Cognito SDK names:
 *   - CodeMismatchException    → InvalidOtpException (400)
 *   - ExpiredCodeException     → SessionExpiredException (410)
 *   - TooManyRequestsException → TooManyAttemptsException (429)
 *   - NotAuthorizedException   → SessionExpiredException (410)  [session gone/used]
 *
 * Security: tokens and device keys returned from Cognito are NEVER logged.
 */
@Injectable()
export class VerifyOtpHandler {
  private readonly logger = new Logger(VerifyOtpHandler.name);

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    this.logger.log(
      `VerifyOtpHandler: responding to EMAIL_OTP challenge for email=${command.email}`,
    );

    let cognitoResponse: Awaited<ReturnType<CognitoService['adminRespondToAuthChallenge']>>;

    try {
      cognitoResponse = await this.cognitoService.adminRespondToAuthChallenge(
        command.email,
        command.session,
        command.otp,
      );
    } catch (error) {
      this.mapChallengeResponseError(error);
      throw error;
    }

    const auth = cognitoResponse.AuthenticationResult;

    if (!auth?.AccessToken || !auth?.IdToken || !auth?.RefreshToken) {
      this.logger.error(
        `VerifyOtpHandler: AuthenticationResult missing tokens for email=${command.email}`,
      );
      throw new Error('Cognito did not return authentication tokens. Please try again.');
    }

    // Tokens are intentionally not logged
    this.logger.log(`VerifyOtpHandler: authentication complete for email=${command.email}`);

    // ── AC-010: Remember Device ─────────────────────────────────────────────
    let deviceKey: string | null = null;

    if (command.rememberDevice && auth.NewDeviceMetadata?.DeviceKey) {
      deviceKey = await this.confirmDeviceAfterAuth(
        auth.AccessToken,
        auth.NewDeviceMetadata.DeviceKey,
        auth.NewDeviceMetadata.DeviceGroupKey ?? '',
      );
    }

    return new VerifyOtpResult({
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn ?? 3600,
      tokenType: 'Bearer',
      deviceKey,
    });
  }

  /**
   * Calls ConfirmDevice after a successful OTP authentication.
   * Generates a random device password, computes the SRP verifier, and registers
   * the device with Cognito. Returns the device key on success, null on failure
   * (a ConfirmDevice failure must not block the authenticated session).
   *
   * Throws DeviceConfirmationFailedException if Cognito rejects the request —
   * callers should surface this as a non-blocking warning to the client.
   */
  private async confirmDeviceAfterAuth(
    accessToken: string,
    deviceKey: string,
    deviceGroupKey: string,
  ): Promise<string | null> {
    try {
      // Generate a cryptographically random 32-byte hex device password
      const devicePassword = crypto.randomBytes(32).toString('hex');

      const { passwordVerifier, salt } = generateDeviceSrpVerifier(
        deviceGroupKey,
        deviceKey,
        devicePassword,
      );

      await this.cognitoService.confirmDevice(accessToken, deviceKey, passwordVerifier, salt);

      this.logger.log(`VerifyOtpHandler: device remembered, deviceKey registered`);
      return deviceKey;
    } catch (error) {
      this.logger.warn(
        `VerifyOtpHandler: ConfirmDevice failed for deviceKey — device will not be remembered`,
        error instanceof Error ? error.message : String(error),
      );
      throw new DeviceConfirmationFailedException();
    }
  }

  /**
   * Maps Cognito SDK exception names to domain exceptions.
   */
  private mapChallengeResponseError(error: unknown): never | void {
    if (!(error instanceof Error)) return;

    switch (error.name) {
      case 'CodeMismatchException':
        throw new InvalidOtpException();

      case 'ExpiredCodeException':
        throw new SessionExpiredException();

      case 'NotAuthorizedException':
        // Session was invalidated or already used
        throw new SessionExpiredException();

      case 'TooManyRequestsException':
        throw new TooManyAttemptsException(
          'Too many incorrect codes. Please start the login process again.',
        );

      default:
        return;
    }
  }
}

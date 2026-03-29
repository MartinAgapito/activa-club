import { Injectable, Logger } from '@nestjs/common';
import { VerifyOtpCommand } from './verify-otp.command';
import { VerifyOtpResult } from './verify-otp.result';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import {
  InvalidOtpException,
  SessionExpiredException,
  TooManyAttemptsException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Verify OTP handler (use case) — AC-002 Step 2.
 *
 * Responds to the Cognito EMAIL_OTP challenge with the code submitted by the member.
 * On success, Cognito returns AccessToken, IdToken, and RefreshToken.
 *
 * Exception mapping from Cognito SDK names:
 *   - CodeMismatchException    → InvalidOtpException (400)
 *   - ExpiredCodeException     → SessionExpiredException (410)
 *   - TooManyRequestsException → TooManyAttemptsException (429)
 *   - NotAuthorizedException   → SessionExpiredException (410)  [session gone/used]
 *
 * Security: tokens returned from Cognito are NEVER logged.
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

    return new VerifyOtpResult({
      accessToken: auth.AccessToken,
      idToken: auth.IdToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn ?? 3600,
      tokenType: 'Bearer',
    });
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

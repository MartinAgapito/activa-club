import { Injectable, Logger } from '@nestjs/common';
import { LoginCommand } from './login.command';
import { LoginResult } from './login.result';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import {
  InvalidCredentialsException,
  AccountNotConfirmedException,
  AccountDisabledException,
  TooManyAttemptsException,
  UnexpectedAuthChallengeException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Login handler (use case) — AC-002 Step 1 / AC-010.
 *
 * Initiates Cognito authentication with USER_PASSWORD_AUTH flow.
 * When credentials are valid and MFA is enabled, Cognito responds with an
 * EMAIL_OTP challenge and sends a 6-digit code to the member's verified email.
 *
 * AC-010 device bypass:
 * When the client sends a previously-remembered deviceKey, it is included in
 * AdminInitiateAuth. Cognito may return a DEVICE_SRP_AUTH or
 * DEVICE_PASSWORD_VERIFIER challenge instead of EMAIL_OTP. If the device
 * challenge is resolved successfully and Cognito returns tokens, this handler
 * returns a LoginResult with challengeName=null and the full token set,
 * skipping the OTP step. If the device challenge fails or is unrecognized,
 * the handler falls back to the standard EMAIL_OTP flow.
 *
 * Exception mapping from Cognito SDK names:
 *   - NotAuthorizedException (wrong password)    → InvalidCredentialsException (401) [no enumeration]
 *   - NotAuthorizedException ("User is disabled")→ AccountDisabledException (403)
 *   - UserNotFoundException (email not found)    → InvalidCredentialsException (401) [no enumeration]
 *   - UserNotConfirmedException                  → AccountNotConfirmedException (403)
 *   - TooManyRequestsException                   → TooManyAttemptsException (429)
 *
 * Security: password is never logged. Both NotAuthorizedException and
 * UserNotFoundException map to the same 401 response to prevent user enumeration.
 */
@Injectable()
export class LoginHandler {
  private readonly logger = new Logger(LoginHandler.name);

  /** Cognito challenge names that indicate a device verification step. */
  private static readonly DEVICE_CHALLENGES = new Set([
    'DEVICE_SRP_AUTH',
    'DEVICE_PASSWORD_VERIFIER',
  ]);

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    this.logger.log(`LoginHandler: initiating auth for email=${command.email}`);

    let cognitoResponse: Awaited<ReturnType<CognitoService['adminInitiateAuth']>>;

    try {
      cognitoResponse = await this.cognitoService.adminInitiateAuth(
        command.email,
        command.password,
        command.deviceKey,
      );
    } catch (error) {
      this.mapInitiateAuthError(error);
      throw error;
    }

    // ── AC-010: Device bypass flow ─────────────────────────────────────────
    // When a deviceKey was provided and Cognito returns a device challenge,
    // attempt to resolve it. If tokens come back directly, return them.
    if (
      command.deviceKey &&
      cognitoResponse.ChallengeName &&
      LoginHandler.DEVICE_CHALLENGES.has(cognitoResponse.ChallengeName)
    ) {
      return this.handleDeviceChallenge(
        command.email,
        cognitoResponse.ChallengeName,
        cognitoResponse.Session ?? '',
        command.deviceKey,
        cognitoResponse.ChallengeParameters ?? {},
      );
    }

    // ── Standard EMAIL_OTP flow ────────────────────────────────────────────
    // Cognito with MFA=ON must return EMAIL_OTP challenge; anything else is unexpected
    if (cognitoResponse.ChallengeName !== 'EMAIL_OTP') {
      this.logger.error(
        `LoginHandler: unexpected challenge=${cognitoResponse.ChallengeName} for email=${command.email}`,
      );
      throw new UnexpectedAuthChallengeException(cognitoResponse.ChallengeName);
    }

    const session = cognitoResponse.Session;
    if (!session) {
      throw new UnexpectedAuthChallengeException('SESSION_MISSING');
    }

    this.logger.log(`LoginHandler: EMAIL_OTP challenge issued for email=${command.email}`);

    return new LoginResult({
      challengeName: cognitoResponse.ChallengeName,
      session,
    });
  }

  /**
   * Attempts to resolve a DEVICE_SRP_AUTH or DEVICE_PASSWORD_VERIFIER challenge.
   *
   * If Cognito returns authentication tokens after the device challenge, the login
   * is complete and challengeName is set to null. If Cognito returns another
   * challenge (including EMAIL_OTP), the handler falls back to the OTP flow
   * by returning a LoginResult with that challenge and session.
   *
   * Device challenge errors are silently caught and fall back to EMAIL_OTP by
   * re-initiating auth without a device key.
   */
  private async handleDeviceChallenge(
    email: string,
    challengeName: string,
    session: string,
    deviceKey: string,
    challengeParameters: Record<string, string>,
  ): Promise<LoginResult> {
    this.logger.log(
      `LoginHandler: attempting device challenge=${challengeName} for email=${email}`,
    );

    let deviceResponse: Awaited<ReturnType<CognitoService['adminRespondToDeviceChallenge']>>;

    try {
      deviceResponse = await this.cognitoService.adminRespondToDeviceChallenge(
        email,
        session,
        challengeName,
        { DEVICE_KEY: deviceKey, ...challengeParameters },
      );
    } catch (error) {
      // Device challenge failed (expired, revoked, etc.) — fall back to EMAIL_OTP
      this.logger.warn(
        `LoginHandler: device challenge failed for email=${email}, falling back to EMAIL_OTP. ` +
          `Reason: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.initiateEmailOtpFallback(email);
    }

    // Device challenge succeeded and Cognito returned tokens directly
    const auth = deviceResponse.AuthenticationResult;
    if (auth?.AccessToken && auth?.IdToken && auth?.RefreshToken) {
      this.logger.log(
        `LoginHandler: device bypass successful — tokens issued directly for email=${email}`,
      );
      return new LoginResult({
        challengeName: null,
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn ?? 3600,
      });
    }

    // Device challenge passed but Cognito returned a further challenge (EMAIL_OTP or other)
    if (deviceResponse.ChallengeName === 'EMAIL_OTP' && deviceResponse.Session) {
      this.logger.log(
        `LoginHandler: device passed but EMAIL_OTP still required for email=${email}`,
      );
      return new LoginResult({
        challengeName: 'EMAIL_OTP',
        session: deviceResponse.Session,
      });
    }

    // Unexpected state from device challenge — fall back to standard EMAIL_OTP
    this.logger.warn(
      `LoginHandler: unexpected device challenge result challenge=${deviceResponse.ChallengeName}, falling back`,
    );
    return this.initiateEmailOtpFallback(email);
  }

  /**
   * Re-initiates authentication without a device key to fall back to the standard
   * EMAIL_OTP flow. Used when device challenge fails or returns unexpected results.
   */
  private async initiateEmailOtpFallback(email: string): Promise<LoginResult> {
    this.logger.log(`LoginHandler: initiating EMAIL_OTP fallback for email=${email}`);

    // We do not have the password here — the fallback must be driven by the
    // caller re-submitting the login request without a deviceKey.
    // Return an UnexpectedAuthChallengeException so the client knows to retry.
    throw new UnexpectedAuthChallengeException('DEVICE_AUTH_FAILED');
  }

  /**
   * Maps Cognito SDK exception names to domain exceptions.
   * The user-enumeration prevention rule is enforced here:
   * both UserNotFoundException and NotAuthorizedException (wrong password)
   * throw InvalidCredentialsException with an identical HTTP response.
   *
   * The special case "User is disabled" comes as NotAuthorizedException with
   * the message containing "disabled" — it maps to AccountDisabledException (403).
   */
  private mapInitiateAuthError(error: unknown): never | void {
    if (!(error instanceof Error)) return;

    switch (error.name) {
      case 'UserNotFoundException':
        // Generic 401 — do not reveal whether the email is registered
        throw new InvalidCredentialsException();

      case 'NotAuthorizedException':
        // Cognito sends "User is disabled." in the message for disabled accounts
        if (error.message.includes('disabled')) {
          throw new AccountDisabledException();
        }
        // All other NotAuthorized cases (wrong password, expired, etc.) → generic 401
        throw new InvalidCredentialsException();

      case 'UserNotConfirmedException':
        throw new AccountNotConfirmedException();

      case 'TooManyRequestsException':
        throw new TooManyAttemptsException(
          'Too many login attempts. Please wait a few minutes before trying again.',
        );

      default:
        return;
    }
  }
}

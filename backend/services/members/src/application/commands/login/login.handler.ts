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
 * Login handler (use case) — AC-002 Step 1.
 *
 * Initiates Cognito authentication with USER_PASSWORD_AUTH flow.
 * When credentials are valid and MFA is enabled, Cognito responds with an
 * EMAIL_OTP challenge and sends a 6-digit code to the member's verified email.
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

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    this.logger.log(`LoginHandler: initiating auth for email=${command.email}`);

    let cognitoResponse: Awaited<ReturnType<CognitoService['adminInitiateAuth']>>;

    try {
      cognitoResponse = await this.cognitoService.adminInitiateAuth(
        command.email,
        command.password,
      );
    } catch (error) {
      this.mapInitiateAuthError(error);
      throw error;
    }

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

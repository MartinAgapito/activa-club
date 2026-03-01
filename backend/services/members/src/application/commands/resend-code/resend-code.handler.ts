import { Injectable, Logger } from '@nestjs/common';
import { ResendCodeCommand } from './resend-code.command';
import { CognitoService } from '../../../infrastructure/cognito/cognito.service';
import {
  TooManyAttemptsException,
  UserNotFoundException,
} from '../../../domain/exceptions/member.exceptions';

/**
 * Resend code handler (use case) — AC-001 Rev2.
 *
 * Calls Cognito ResendConfirmationCode to send a new 6-digit OTP to the
 * member's email when the original code expired or was not received.
 *
 * Exception mapping from Cognito SDK names:
 *   - LimitExceededException / TooManyRequestsException → TooManyAttemptsException (429)
 *   - UserNotFoundException                             → UserNotFoundException (404)
 *
 * Returns void — the HTTP response body is assembled in the controller.
 */
@Injectable()
export class ResendCodeHandler {
  private readonly logger = new Logger(ResendCodeHandler.name);

  constructor(private readonly cognitoService: CognitoService) {}

  async execute(command: ResendCodeCommand): Promise<void> {
    try {
      await this.cognitoService.resendConfirmationCode(command.email);
      this.logger.log(`ResendCodeHandler: new OTP sent to email=${command.email}`);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.name) {
          case 'LimitExceededException':
          case 'TooManyRequestsException':
            throw new TooManyAttemptsException(
              'Too many code requests. Please wait a few minutes before trying again.',
            );
          case 'UserNotFoundException':
            throw new UserNotFoundException();
          default:
            // Unknown error — propagate for global filter
            throw error;
        }
      }
      throw error;
    }
  }
}

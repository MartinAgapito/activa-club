import { ResendCodeHandler } from '../../application/commands/resend-code/resend-code.handler';
import { ResendCodeCommand } from '../../application/commands/resend-code/resend-code.command';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import {
  TooManyAttemptsException,
  UserNotFoundException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCognitoService = {
  resendConfirmationCode: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Helper ───────────────────────────────────────────────────────────────────

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResendCodeHandler (AC-001 Rev2)', () => {
  let handler: ResendCodeHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ResendCodeHandler(mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('returns void on success', async () => {
      mockCognitoService.resendConfirmationCode.mockResolvedValue(undefined);

      const result = await handler.execute(new ResendCodeCommand('martin.garcia@email.com'));

      expect(result).toBeUndefined();
    });

    it('calls resendConfirmationCode with the provided email', async () => {
      mockCognitoService.resendConfirmationCode.mockResolvedValue(undefined);

      await handler.execute(new ResendCodeCommand('martin.garcia@email.com'));

      expect(mockCognitoService.resendConfirmationCode).toHaveBeenCalledWith(
        'martin.garcia@email.com',
      );
    });
  });

  // ── Error mapping ───────────────────────────────────────────────────────────

  describe('execute — Cognito error mapping', () => {
    it('throws TooManyAttemptsException on LimitExceededException', async () => {
      mockCognitoService.resendConfirmationCode.mockRejectedValue(
        cognitoError('LimitExceededException'),
      );

      await expect(handler.execute(new ResendCodeCommand('test@email.com'))).rejects.toThrow(
        TooManyAttemptsException,
      );
    });

    it('throws TooManyAttemptsException on TooManyRequestsException', async () => {
      mockCognitoService.resendConfirmationCode.mockRejectedValue(
        cognitoError('TooManyRequestsException'),
      );

      await expect(handler.execute(new ResendCodeCommand('test@email.com'))).rejects.toThrow(
        TooManyAttemptsException,
      );
    });

    it('throws UserNotFoundException on UserNotFoundException', async () => {
      mockCognitoService.resendConfirmationCode.mockRejectedValue(
        cognitoError('UserNotFoundException'),
      );

      await expect(handler.execute(new ResendCodeCommand('test@email.com'))).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('propagates unknown errors without mapping', async () => {
      const unknownError = new Error('Something unexpected');
      unknownError.name = 'SomeOtherCognitoException';
      mockCognitoService.resendConfirmationCode.mockRejectedValue(unknownError);

      await expect(handler.execute(new ResendCodeCommand('test@email.com'))).rejects.toThrow(
        unknownError,
      );
    });
  });
});

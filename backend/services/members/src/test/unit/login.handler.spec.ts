import { LoginHandler } from '../../application/commands/login/login.handler';
import { LoginCommand } from '../../application/commands/login/login.command';
import { LoginResult } from '../../application/commands/login/login.result';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import {
  InvalidCredentialsException,
  AccountNotConfirmedException,
  AccountDisabledException,
  TooManyAttemptsException,
  UnexpectedAuthChallengeException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCognitoService = {
  adminInitiateAuth: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

function makeEmailOtpResponse(session = 'cognito-session-abc123') {
  return {
    ChallengeName: 'EMAIL_OTP',
    Session: session,
    ChallengeParameters: { USERNAME: 'martin.garcia@email.com' },
    $metadata: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginHandler (AC-002 Step 1)', () => {
  let handler: LoginHandler;

  const VALID_COMMAND = new LoginCommand('martin.garcia@email.com', 'SecurePass1!');

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new LoginHandler(mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('returns a LoginResult with challengeName and session when EMAIL_OTP is returned', async () => {
      const cognitoResponse = makeEmailOtpResponse();
      mockCognitoService.adminInitiateAuth.mockResolvedValue(cognitoResponse as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result).toBeInstanceOf(LoginResult);
      expect(result.challengeName).toBe('EMAIL_OTP');
      expect(result.session).toBe('cognito-session-abc123');
    });

    it('calls adminInitiateAuth with USER_PASSWORD_AUTH flow and correct credentials', async () => {
      mockCognitoService.adminInitiateAuth.mockResolvedValue(
        makeEmailOtpResponse() as never,
      );

      await handler.execute(VALID_COMMAND);

      expect(mockCognitoService.adminInitiateAuth).toHaveBeenCalledWith(
        VALID_COMMAND.email,
        VALID_COMMAND.password,
      );
    });
  });

  // ── Unexpected challenge ────────────────────────────────────────────────────

  describe('execute — unexpected Cognito challenge', () => {
    it('throws UnexpectedAuthChallengeException when Cognito returns a non-EMAIL_OTP challenge', async () => {
      mockCognitoService.adminInitiateAuth.mockResolvedValue({
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: 'some-session',
        $metadata: {},
      } as never);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(
        UnexpectedAuthChallengeException,
      );
    });

    it('throws UnexpectedAuthChallengeException when Cognito returns tokens directly (no challenge)', async () => {
      mockCognitoService.adminInitiateAuth.mockResolvedValue({
        AuthenticationResult: { AccessToken: 'tok', IdToken: 'id', RefreshToken: 'ref' },
        $metadata: {},
      } as never);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(
        UnexpectedAuthChallengeException,
      );
    });

    it('throws UnexpectedAuthChallengeException when Session is missing', async () => {
      mockCognitoService.adminInitiateAuth.mockResolvedValue({
        ChallengeName: 'EMAIL_OTP',
        // Session deliberately omitted
        $metadata: {},
      } as never);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(
        UnexpectedAuthChallengeException,
      );
    });
  });

  // ── Cognito error mapping ─────────────────────────────────────────────────

  describe('execute — Cognito error mapping', () => {
    it('throws InvalidCredentialsException on NotAuthorizedException (wrong password)', async () => {
      mockCognitoService.adminInitiateAuth.mockRejectedValue(
        cognitoError('NotAuthorizedException', 'Incorrect username or password.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws InvalidCredentialsException on UserNotFoundException — no user enumeration', async () => {
      mockCognitoService.adminInitiateAuth.mockRejectedValue(
        cognitoError('UserNotFoundException', 'User does not exist.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidCredentialsException);
    });

    it('maps both NotAuthorizedException and UserNotFoundException to the same InvalidCredentialsException — no enumeration', async () => {
      // This test verifies that both exceptions produce identical exception types
      // (user enumeration prevention as specified in AC-002)
      const notAuthorizedError = cognitoError('NotAuthorizedException', 'Incorrect username or password.');
      const userNotFoundError = cognitoError('UserNotFoundException', 'User does not exist.');

      mockCognitoService.adminInitiateAuth.mockRejectedValueOnce(notAuthorizedError);
      const result1 = await handler.execute(VALID_COMMAND).catch((e) => e);

      mockCognitoService.adminInitiateAuth.mockRejectedValueOnce(userNotFoundError);
      const result2 = await handler.execute(VALID_COMMAND).catch((e) => e);

      expect(result1).toBeInstanceOf(InvalidCredentialsException);
      expect(result2).toBeInstanceOf(InvalidCredentialsException);
      expect(result1.code).toBe(result2.code);
      expect(result1.message).toBe(result2.message);
    });

    it('throws AccountDisabledException when NotAuthorizedException message contains "disabled"', async () => {
      mockCognitoService.adminInitiateAuth.mockRejectedValue(
        cognitoError('NotAuthorizedException', 'User is disabled.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AccountDisabledException);
    });

    it('throws AccountNotConfirmedException on UserNotConfirmedException', async () => {
      mockCognitoService.adminInitiateAuth.mockRejectedValue(
        cognitoError('UserNotConfirmedException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(AccountNotConfirmedException);
    });

    it('throws TooManyAttemptsException on TooManyRequestsException', async () => {
      mockCognitoService.adminInitiateAuth.mockRejectedValue(
        cognitoError('TooManyRequestsException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(TooManyAttemptsException);
    });

    it('propagates unknown errors without mapping', async () => {
      const unknownError = cognitoError('SomeUnknownException', 'Unexpected error');
      mockCognitoService.adminInitiateAuth.mockRejectedValue(unknownError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(unknownError);
    });
  });
});

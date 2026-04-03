import { LogoutHandler } from '../../application/commands/logout/logout.handler';
import { LogoutCommand } from '../../application/commands/logout/logout.command';
import { LogoutResult } from '../../application/commands/logout/logout.result';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import {
  InvalidTokenException,
  LogoutFailedException,
} from '../../domain/exceptions/member.exceptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal JWT string with the given payload claims.
 * The header and signature are stubs — only the payload matters here.
 */
function buildFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'fake-signature';
  return `${header}.${body}.${signature}`;
}

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCognitoService = {
  adminUserGlobalSignOut: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LogoutHandler (AC-008)', () => {
  let handler: LogoutHandler;

  const USERNAME = 'martin.garcia@email.com';
  const VALID_TOKEN = buildFakeJwt({ username: USERNAME, sub: 'cognito-sub-123' });
  const VALID_COMMAND = new LogoutCommand(VALID_TOKEN);

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new LogoutHandler(mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — happy path', () => {
    it('returns a LogoutResult with the success message on valid token', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockResolvedValue(undefined as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result).toBeInstanceOf(LogoutResult);
      expect(result.message).toBe('Sesión cerrada correctamente');
    });

    it('calls adminUserGlobalSignOut with the username extracted from the token payload', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockResolvedValue(undefined as never);

      await handler.execute(VALID_COMMAND);

      expect(mockCognitoService.adminUserGlobalSignOut).toHaveBeenCalledTimes(1);
      expect(mockCognitoService.adminUserGlobalSignOut).toHaveBeenCalledWith(USERNAME);
    });

    it('extracts username from cognito:username claim when username claim is absent', async () => {
      const token = buildFakeJwt({ 'cognito:username': USERNAME, sub: 'cognito-sub-123' });
      mockCognitoService.adminUserGlobalSignOut.mockResolvedValue(undefined as never);

      await handler.execute(new LogoutCommand(token));

      expect(mockCognitoService.adminUserGlobalSignOut).toHaveBeenCalledWith(USERNAME);
    });

    it('falls back to sub claim when neither username nor cognito:username is present', async () => {
      const sub = 'cognito-sub-fallback';
      const token = buildFakeJwt({ sub });
      mockCognitoService.adminUserGlobalSignOut.mockResolvedValue(undefined as never);

      await handler.execute(new LogoutCommand(token));

      expect(mockCognitoService.adminUserGlobalSignOut).toHaveBeenCalledWith(sub);
    });
  });

  // ── Malformed / invalid tokens ──────────────────────────────────────────────

  describe('execute — invalid or malformed token', () => {
    it('throws InvalidTokenException when the token is not a valid JWT (no dots)', async () => {
      await expect(handler.execute(new LogoutCommand('not-a-jwt'))).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('throws InvalidTokenException when the token has only two segments', async () => {
      await expect(handler.execute(new LogoutCommand('header.payload'))).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('throws InvalidTokenException when the payload is not valid Base64', async () => {
      await expect(
        handler.execute(new LogoutCommand('header.!!!invalid_base64!!!.signature')),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('throws InvalidTokenException when the payload has no username, cognito:username, or sub claims', async () => {
      const token = buildFakeJwt({ email: USERNAME }); // no username/sub claims
      await expect(handler.execute(new LogoutCommand(token))).rejects.toThrow(
        InvalidTokenException,
      );
    });
  });

  // ── Cognito error mapping ─────────────────────────────────────────────────

  describe('execute — Cognito error mapping', () => {
    it('throws InvalidTokenException on UserNotFoundException', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockRejectedValue(
        cognitoError('UserNotFoundException', 'User does not exist.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidTokenException);
    });

    it('throws InvalidTokenException on NotAuthorizedException', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockRejectedValue(
        cognitoError('NotAuthorizedException', 'Access token is not valid.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidTokenException);
    });

    it('throws LogoutFailedException on unexpected Cognito errors', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockRejectedValue(
        cognitoError('InternalErrorException', 'Internal service error.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(LogoutFailedException);
    });

    it('throws LogoutFailedException on TooManyRequestsException', async () => {
      mockCognitoService.adminUserGlobalSignOut.mockRejectedValue(
        cognitoError('TooManyRequestsException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(LogoutFailedException);
    });
  });
});

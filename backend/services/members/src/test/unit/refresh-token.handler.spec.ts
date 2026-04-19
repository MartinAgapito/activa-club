import { RefreshTokenHandler } from '../../application/commands/refresh-token/refresh-token.handler';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import {
  InvalidTokenException,
  SessionExpiredException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCognitoService = {
  refreshTokens: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

function makeTokensResponse(overrides?: Partial<{ expiresIn: number; tokenType: string }>) {
  return {
    accessToken: 'eyJraWQiOiJ-access',
    idToken: 'eyJraWQiOiJ-id',
    expiresIn: overrides?.expiresIn ?? 3600,
    tokenType: overrides?.tokenType ?? 'Bearer',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RefreshTokenHandler (AC-010)', () => {
  let handler: RefreshTokenHandler;

  const VALID_COMMAND = new RefreshTokenCommand('eyJjdHkiOiJ-refresh');

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new RefreshTokenHandler(mockCognitoService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('execute — successful token refresh', () => {
    it('returns tokens from cognitoService.refreshTokens', async () => {
      const tokens = makeTokensResponse();
      mockCognitoService.refreshTokens.mockResolvedValue(tokens as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result.accessToken).toBe(tokens.accessToken);
      expect(result.idToken).toBe(tokens.idToken);
      expect(result.expiresIn).toBe(3600);
      expect(result.tokenType).toBe('Bearer');
    });

    it('calls cognitoService.refreshTokens with the correct refresh token', async () => {
      mockCognitoService.refreshTokens.mockResolvedValue(makeTokensResponse() as never);

      await handler.execute(VALID_COMMAND);

      expect(mockCognitoService.refreshTokens).toHaveBeenCalledWith(VALID_COMMAND.refreshToken);
    });

    it('uses expiresIn from Cognito when provided', async () => {
      const tokens = makeTokensResponse({ expiresIn: 7200 });
      mockCognitoService.refreshTokens.mockResolvedValue(tokens as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result.expiresIn).toBe(7200);
    });
  });

  // ── Cognito error mapping ─────────────────────────────────────────────────

  describe('execute — Cognito error mapping', () => {
    it('throws InvalidTokenException on NotAuthorizedException', async () => {
      mockCognitoService.refreshTokens.mockRejectedValue(
        cognitoError('NotAuthorizedException', 'Refresh Token has expired'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidTokenException);
    });

    it('throws SessionExpiredException on UserNotFoundException', async () => {
      mockCognitoService.refreshTokens.mockRejectedValue(
        cognitoError('UserNotFoundException', 'User does not exist.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(SessionExpiredException);
    });

    it('propagates unknown Error errors without mapping to a domain exception', async () => {
      const unknownError = cognitoError('SomeUnknownCognitoException');
      mockCognitoService.refreshTokens.mockRejectedValue(unknownError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(unknownError);
      await expect(handler.execute(VALID_COMMAND)).rejects.not.toThrow(InvalidTokenException);
      await expect(handler.execute(VALID_COMMAND)).rejects.not.toThrow(SessionExpiredException);
    });

    it('propagates non-Error throws without mapping', async () => {
      mockCognitoService.refreshTokens.mockRejectedValue('plain string error');

      await expect(handler.execute(VALID_COMMAND)).rejects.toBe('plain string error');
    });
  });
});

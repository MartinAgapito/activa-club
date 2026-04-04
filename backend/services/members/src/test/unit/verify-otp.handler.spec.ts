import { VerifyOtpHandler } from '../../application/commands/verify-otp/verify-otp.handler';
import { VerifyOtpCommand } from '../../application/commands/verify-otp/verify-otp.command';
import { VerifyOtpResult } from '../../application/commands/verify-otp/verify-otp.result';
import { CognitoService } from '../../infrastructure/cognito/cognito.service';
import {
  InvalidOtpException,
  SessionExpiredException,
  TooManyAttemptsException,
  DeviceConfirmationFailedException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCognitoService = {
  adminRespondToAuthChallenge: jest.fn(),
  confirmDevice: jest.fn(),
} as unknown as jest.Mocked<CognitoService>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cognitoError(name: string, message?: string): Error {
  const error = new Error(message ?? name);
  error.name = name;
  return error;
}

function makeSuccessResponse(withDeviceMetadata = false) {
  return {
    AuthenticationResult: {
      AccessToken: 'eyJraWQiOiJ-access',
      IdToken: 'eyJraWQiOiJ-id',
      RefreshToken: 'eyJjdHkiOiJ-refresh',
      ExpiresIn: 3600,
      TokenType: 'Bearer',
      ...(withDeviceMetadata
        ? {
            NewDeviceMetadata: {
              DeviceKey: 'us-east-1_device-key-abc',
              DeviceGroupKey: 'us-east-1_group-key',
            },
          }
        : {}),
    },
    $metadata: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VerifyOtpHandler (AC-002 Step 2 / AC-010)', () => {
  let handler: VerifyOtpHandler;

  const VALID_COMMAND = new VerifyOtpCommand(
    'martin.garcia@email.com',
    'cognito-session-abc123',
    '482917',
  );

  const REMEMBER_DEVICE_COMMAND = new VerifyOtpCommand(
    'martin.garcia@email.com',
    'cognito-session-abc123',
    '482917',
    true,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new VerifyOtpHandler(mockCognitoService);
  });

  // ── Happy path (standard OTP, rememberDevice = false) ──────────────────────

  describe('execute — standard OTP flow (rememberDevice=false)', () => {
    it('returns a VerifyOtpResult with all tokens from Cognito', async () => {
      const cognitoResponse = makeSuccessResponse();
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(cognitoResponse as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result).toBeInstanceOf(VerifyOtpResult);
      expect(result.accessToken).toBe(cognitoResponse.AuthenticationResult.AccessToken);
      expect(result.idToken).toBe(cognitoResponse.AuthenticationResult.IdToken);
      expect(result.refreshToken).toBe(cognitoResponse.AuthenticationResult.RefreshToken);
      expect(result.expiresIn).toBe(3600);
      expect(result.tokenType).toBe('Bearer');
    });

    it('sets deviceKey to null when rememberDevice is false', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(true) as never,
      );

      const result = await handler.execute(VALID_COMMAND);

      expect(result.deviceKey).toBeNull();
      expect(mockCognitoService.confirmDevice).not.toHaveBeenCalled();
    });

    it('sets deviceKey to null when rememberDevice is false and no NewDeviceMetadata', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(false) as never,
      );

      const result = await handler.execute(VALID_COMMAND);

      expect(result.deviceKey).toBeNull();
      expect(mockCognitoService.confirmDevice).not.toHaveBeenCalled();
    });

    it('calls adminRespondToAuthChallenge with correct arguments', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse() as never,
      );

      await handler.execute(VALID_COMMAND);

      expect(mockCognitoService.adminRespondToAuthChallenge).toHaveBeenCalledWith(
        VALID_COMMAND.email,
        VALID_COMMAND.session,
        VALID_COMMAND.otp,
      );
    });

    it('defaults expiresIn to 3600 when Cognito does not return ExpiresIn', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue({
        AuthenticationResult: {
          AccessToken: 'tok',
          IdToken: 'id',
          RefreshToken: 'ref',
          // ExpiresIn deliberately omitted
        },
        $metadata: {},
      } as never);

      const result = await handler.execute(VALID_COMMAND);

      expect(result.expiresIn).toBe(3600);
    });
  });

  // ── AC-010: rememberDevice = true, device confirmation succeeds ─────────────

  describe('execute — AC-010 rememberDevice=true (success)', () => {
    it('calls confirmDevice when rememberDevice=true and NewDeviceMetadata is present', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(true) as never,
      );
      mockCognitoService.confirmDevice.mockResolvedValue(undefined);

      await handler.execute(REMEMBER_DEVICE_COMMAND);

      expect(mockCognitoService.confirmDevice).toHaveBeenCalledTimes(1);
      // Called with: accessToken, deviceKey, passwordVerifier (base64), salt (base64)
      expect(mockCognitoService.confirmDevice).toHaveBeenCalledWith(
        'eyJraWQiOiJ-access',
        'us-east-1_device-key-abc',
        expect.any(String), // passwordVerifier — computed from SRP
        expect.any(String), // salt — random bytes
      );
    });

    it('returns deviceKey in result when rememberDevice=true and ConfirmDevice succeeds', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(true) as never,
      );
      mockCognitoService.confirmDevice.mockResolvedValue(undefined);

      const result = await handler.execute(REMEMBER_DEVICE_COMMAND);

      expect(result.deviceKey).toBe('us-east-1_device-key-abc');
    });

    it('returns all tokens alongside deviceKey', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(true) as never,
      );
      mockCognitoService.confirmDevice.mockResolvedValue(undefined);

      const result = await handler.execute(REMEMBER_DEVICE_COMMAND);

      expect(result.accessToken).toBe('eyJraWQiOiJ-access');
      expect(result.idToken).toBe('eyJraWQiOiJ-id');
      expect(result.refreshToken).toBe('eyJjdHkiOiJ-refresh');
      expect(result.deviceKey).toBe('us-east-1_device-key-abc');
    });
  });

  // ── AC-010: rememberDevice = true, no NewDeviceMetadata ────────────────────

  describe('execute — AC-010 rememberDevice=true but no NewDeviceMetadata', () => {
    it('does not call confirmDevice when NewDeviceMetadata is absent', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(false) as never,
      );

      const result = await handler.execute(REMEMBER_DEVICE_COMMAND);

      expect(mockCognitoService.confirmDevice).not.toHaveBeenCalled();
      expect(result.deviceKey).toBeNull();
    });
  });

  // ── AC-010: rememberDevice = true, ConfirmDevice fails ─────────────────────

  describe('execute — AC-010 ConfirmDevice failure', () => {
    it('throws DeviceConfirmationFailedException when confirmDevice rejects', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue(
        makeSuccessResponse(true) as never,
      );
      mockCognitoService.confirmDevice.mockRejectedValue(new Error('Cognito ConfirmDevice error'));

      await expect(handler.execute(REMEMBER_DEVICE_COMMAND)).rejects.toThrow(
        DeviceConfirmationFailedException,
      );
    });
  });

  // ── Missing tokens ──────────────────────────────────────────────────────────

  describe('execute — missing tokens in response', () => {
    it('throws when AuthenticationResult is missing entirely', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue({
        $metadata: {},
      } as never);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow();
    });

    it('throws when AccessToken is missing', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockResolvedValue({
        AuthenticationResult: {
          IdToken: 'id',
          RefreshToken: 'ref',
          ExpiresIn: 3600,
        },
        $metadata: {},
      } as never);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow();
    });
  });

  // ── Cognito error mapping ─────────────────────────────────────────────────

  describe('execute — Cognito error mapping', () => {
    it('throws InvalidOtpException on CodeMismatchException', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockRejectedValue(
        cognitoError('CodeMismatchException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(InvalidOtpException);
    });

    it('throws SessionExpiredException on ExpiredCodeException', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockRejectedValue(
        cognitoError('ExpiredCodeException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(SessionExpiredException);
    });

    it('throws SessionExpiredException on NotAuthorizedException (session expired or used)', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockRejectedValue(
        cognitoError('NotAuthorizedException', 'Invalid session for the user.'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(SessionExpiredException);
    });

    it('throws TooManyAttemptsException on TooManyRequestsException', async () => {
      mockCognitoService.adminRespondToAuthChallenge.mockRejectedValue(
        cognitoError('TooManyRequestsException'),
      );

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(TooManyAttemptsException);
    });

    it('propagates unknown errors without mapping', async () => {
      const unknownError = cognitoError('SomeUnknownException');
      mockCognitoService.adminRespondToAuthChallenge.mockRejectedValue(unknownError);

      await expect(handler.execute(VALID_COMMAND)).rejects.toThrow(unknownError);
    });
  });
});

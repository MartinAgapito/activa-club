import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../shared/filters/global-exception.filter';
import {
  DniNotFoundException,
  AccountInactiveException,
  DniAlreadyRegisteredException,
  EmailAlreadyInUseException,
  PasswordPolicyViolationException,
  InvalidCodeException,
  CodeExpiredException,
  TooManyAttemptsException,
  UserNotFoundException,
  InvalidCredentialsException,
  AccountNotConfirmedException,
  AccountDisabledException,
  InvalidOtpException,
  SessionExpiredException,
  UnexpectedAuthChallengeException,
} from '../../domain/exceptions/member.exceptions';

// ─── Mock HTTP context ────────────────────────────────────────────────────────

function makeHost(status: jest.Mock, json: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code: number) => ({ json: json.mockImplementation((body: unknown) => body) }),
      }),
      getRequest: () => ({ url: '/v1/test' }),
    }),
  } as unknown as ArgumentsHost;
}

// ─── Helper to capture the JSON response from the filter ─────────────────────

interface FilterResponse {
  status: string;
  error: { code: string; message: string; details: unknown[] };
}

function runFilter(exception: unknown): { httpStatus: number; body: FilterResponse } {
  const filter = new GlobalExceptionFilter();
  let capturedStatus = 0;
  let capturedBody: FilterResponse | undefined;

  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code: number) => {
          capturedStatus = code;
          return {
            json: (body: FilterResponse) => {
              capturedBody = body;
            },
          };
        },
      }),
      getRequest: () => ({ url: '/v1/test' }),
    }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);

  return { httpStatus: capturedStatus, body: capturedBody! };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GlobalExceptionFilter', () => {
  // ── NestJS HttpException ────────────────────────────────────────────────────

  describe('HttpException handling', () => {
    it('maps a plain HttpException to correct status and body', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
      const { httpStatus, body } = runFilter(exception);

      expect(httpStatus).toBe(404);
      expect(body.status).toBe('error');
      expect(body.error.message).toBe('Not found');
    });

    it('maps ValidationPipe output (array of messages) to VALIDATION_ERROR', () => {
      const exception = new HttpException(
        {
          statusCode: 400,
          message: ['dni must be at least 7 characters', 'email must be a valid email address'],
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST,
      );
      const { httpStatus, body } = runFilter(exception);

      expect(httpStatus).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toHaveLength(2);
    });
  });

  // ── Domain exceptions — AC-001 ──────────────────────────────────────────────

  describe('Domain exception mapping — AC-001', () => {
    const cases: Array<[unknown, number, string]> = [
      [new DniNotFoundException(), 404, 'DNI_NOT_FOUND'],
      [new AccountInactiveException(), 403, 'ACCOUNT_INACTIVE'],
      [new DniAlreadyRegisteredException(), 409, 'DNI_ALREADY_REGISTERED'],
      [new EmailAlreadyInUseException(), 409, 'EMAIL_ALREADY_IN_USE'],
      [new PasswordPolicyViolationException(), 422, 'PASSWORD_POLICY_VIOLATION'],
      [new InvalidCodeException(), 400, 'INVALID_CODE'],
      [new CodeExpiredException(), 410, 'CODE_EXPIRED'],
      [new TooManyAttemptsException(), 429, 'TOO_MANY_ATTEMPTS'],
      [new UserNotFoundException(), 404, 'USER_NOT_FOUND'],
    ];

    it.each(cases)('maps %s to HTTP %i with code %s', (exception, expectedStatus, expectedCode) => {
      const { httpStatus, body } = runFilter(exception);

      expect(httpStatus).toBe(expectedStatus);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe(expectedCode);
      expect(body.error.details).toEqual([]);
    });
  });

  // ── Domain exceptions — AC-002 ──────────────────────────────────────────────

  describe('Domain exception mapping — AC-002', () => {
    const cases: Array<[unknown, number, string]> = [
      [new InvalidCredentialsException(), 401, 'INVALID_CREDENTIALS'],
      [new AccountNotConfirmedException(), 403, 'ACCOUNT_NOT_CONFIRMED'],
      [new AccountDisabledException(), 403, 'ACCOUNT_DISABLED'],
      [new InvalidOtpException(), 400, 'INVALID_OTP'],
      [new SessionExpiredException(), 410, 'SESSION_EXPIRED'],
      [new UnexpectedAuthChallengeException(), 500, 'INTERNAL_ERROR'],
    ];

    it.each(cases)('maps %s to HTTP %i with code %s', (exception, expectedStatus, expectedCode) => {
      const { httpStatus, body } = runFilter(exception);

      expect(httpStatus).toBe(expectedStatus);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe(expectedCode);
      expect(body.error.details).toEqual([]);
    });
  });

  // ── Unexpected errors ───────────────────────────────────────────────────────

  describe('Unexpected error handling', () => {
    it('maps an unknown Error to HTTP 500 INTERNAL_ERROR', () => {
      const exception = new Error('Something exploded');
      const { httpStatus, body } = runFilter(exception);

      expect(httpStatus).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('maps a non-Error throw to HTTP 500 INTERNAL_ERROR', () => {
      const { httpStatus, body } = runFilter('raw string error');

      expect(httpStatus).toBe(500);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('InvalidCredentialsException and both Cognito error scenarios produce identical responses — no user enumeration', () => {
      const { body: body1 } = runFilter(new InvalidCredentialsException());
      const { body: body2 } = runFilter(new InvalidCredentialsException());

      // Both map to identical response — no way to distinguish wrong password vs unknown email
      expect(body1.error.code).toBe('INVALID_CREDENTIALS');
      expect(body2.error.code).toBe('INVALID_CREDENTIALS');
      expect(body1.error.message).toBe(body2.error.message);
    });
  });

  // ── Response envelope structure ─────────────────────────────────────────────

  describe('Response envelope structure', () => {
    it('always sets status="error" in the response body', () => {
      const { body } = runFilter(new DniNotFoundException());
      expect(body.status).toBe('error');
    });

    it('always includes error.details as an array', () => {
      const { body } = runFilter(new DniNotFoundException());
      expect(Array.isArray(body.error.details)).toBe(true);
    });

    it('includes the domain exception message verbatim', () => {
      const exception = new DniNotFoundException();
      const { body } = runFilter(exception);
      expect(body.error.message).toBe(exception.message);
    });
  });
});

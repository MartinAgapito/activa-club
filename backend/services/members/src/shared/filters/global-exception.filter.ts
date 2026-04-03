import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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

/**
 * Standard error response envelope.
 *
 * ```json
 * {
 *   "status": "error",
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human readable message",
 *     "details": []
 *   }
 * }
 * ```
 */
interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
}

/**
 * Maps domain exception class names to HTTP status codes and error codes.
 */
const DOMAIN_EXCEPTION_MAP: Record<string, { httpStatus: HttpStatus; code: string }> = {
  // AC-001 — Registration
  DniNotFoundException: { httpStatus: HttpStatus.NOT_FOUND, code: 'DNI_NOT_FOUND' },
  AccountInactiveException: { httpStatus: HttpStatus.FORBIDDEN, code: 'ACCOUNT_INACTIVE' },
  DniAlreadyRegisteredException: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'DNI_ALREADY_REGISTERED',
  },
  EmailAlreadyInUseException: { httpStatus: HttpStatus.CONFLICT, code: 'EMAIL_ALREADY_IN_USE' },
  PasswordPolicyViolationException: {
    httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'PASSWORD_POLICY_VIOLATION',
  },
  InvalidCodeException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'INVALID_CODE' },
  CodeExpiredException: { httpStatus: HttpStatus.GONE, code: 'CODE_EXPIRED' },
  TooManyAttemptsException: {
    httpStatus: HttpStatus.TOO_MANY_REQUESTS,
    code: 'TOO_MANY_ATTEMPTS',
  },
  UserNotFoundException: { httpStatus: HttpStatus.NOT_FOUND, code: 'USER_NOT_FOUND' },

  // AC-002 — Login
  InvalidCredentialsException: {
    httpStatus: HttpStatus.UNAUTHORIZED,
    code: 'INVALID_CREDENTIALS',
  },
  AccountNotConfirmedException: {
    httpStatus: HttpStatus.FORBIDDEN,
    code: 'ACCOUNT_NOT_CONFIRMED',
  },
  AccountDisabledException: { httpStatus: HttpStatus.FORBIDDEN, code: 'ACCOUNT_DISABLED' },
  InvalidOtpException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'INVALID_OTP' },
  SessionExpiredException: { httpStatus: HttpStatus.GONE, code: 'SESSION_EXPIRED' },
  UnexpectedAuthChallengeException: {
    httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
  },
};

/**
 * Global exception filter.
 *
 * Catches all exceptions and maps them to the standard error envelope.
 * Handles:
 *   1. NestJS HttpException (from ValidationPipe, etc.)
 *   2. Domain exceptions (mapped via DOMAIN_EXCEPTION_MAP)
 *   3. Unexpected errors (HTTP 500)
 *
 * Passwords and tokens are never logged — only error names and paths.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    response.status(errorResponse.httpStatus).json(errorResponse.body);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): { httpStatus: number; body: ErrorResponse } {
    // ── NestJS HttpException (ValidationPipe, manual throws) ─────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let code = 'HTTP_ERROR';
      let message = exception.message;
      let details: unknown[] = [];

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        // ValidationPipe returns { statusCode, message: string[], error }
        if (Array.isArray(res['message'])) {
          code = 'VALIDATION_ERROR';
          message = 'One or more fields failed validation.';
          details = res['message'] as string[];
        } else if (typeof res['message'] === 'string') {
          message = res['message'];
        }
      }

      this.logger.warn(`HttpException: status=${status}, code=${code}, path=${request.url}`);

      return {
        httpStatus: status,
        body: { status: 'error', error: { code, message, details } },
      };
    }

    // ── Domain exceptions ─────────────────────────────────────────────────────
    if (exception instanceof Error) {
      const mapping = DOMAIN_EXCEPTION_MAP[exception.name];

      if (mapping) {
        this.logger.warn(
          `DomainException: name=${exception.name}, code=${mapping.code}, path=${request.url}`,
        );

        return {
          httpStatus: mapping.httpStatus,
          body: {
            status: 'error',
            error: { code: mapping.code, message: exception.message, details: [] },
          },
        };
      }

      // ── Unexpected error ──────────────────────────────────────────────────
      this.logger.error(
        `UnhandledException: name=${exception.name}, message=${exception.message}, path=${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `UnhandledException (non-Error): ${String(exception)}, path=${request.url}`,
      );
    }

    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          details: [],
        },
      },
    };
  }
}

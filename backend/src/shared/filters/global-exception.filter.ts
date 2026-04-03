import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

/** Maps a domain exception class name to its HTTP status code. */
const DOMAIN_EXCEPTION_MAP: Record<string, number> = {
  // AC-001 — Registration
  DniNotFoundException: HttpStatus.NOT_FOUND,
  AccountInactiveException: HttpStatus.FORBIDDEN,
  DniAlreadyRegisteredException: HttpStatus.CONFLICT,
  EmailAlreadyInUseException: HttpStatus.CONFLICT,
  PasswordPolicyViolationException: HttpStatus.UNPROCESSABLE_ENTITY,
  InvalidCodeException: HttpStatus.BAD_REQUEST,
  CodeExpiredException: HttpStatus.GONE,
  UserNotFoundException: HttpStatus.NOT_FOUND,
  // AC-002 — Login + OTP
  InvalidCredentialsException: HttpStatus.UNAUTHORIZED,
  AccountNotConfirmedException: HttpStatus.FORBIDDEN,
  AccountDisabledException: HttpStatus.FORBIDDEN,
  InvalidOtpException: HttpStatus.BAD_REQUEST,
  SessionExpiredException: HttpStatus.GONE,
  TooManyAttemptsException: HttpStatus.TOO_MANY_REQUESTS,
  UnexpectedAuthChallengeException: HttpStatus.INTERNAL_SERVER_ERROR,
  // AC-008 — Logout
  InvalidTokenException: HttpStatus.UNAUTHORIZED,
  LogoutFailedException: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Global exception filter.
 *
 * Catches all unhandled exceptions and returns a consistent JSON error shape.
 * HttpExceptions are passed through with their status code.
 * Domain exceptions are mapped to HTTP status codes via DOMAIN_EXCEPTION_MAP.
 * All other errors are treated as Internal Server Errors (500).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.message;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj['message'] as string | string[]) ?? exception.message;
        error = (responseObj['error'] as string) ?? HttpStatus[statusCode];
      } else {
        message = exception.message;
        error = HttpStatus[statusCode];
      }
    } else if (exception instanceof Error && exception.name in DOMAIN_EXCEPTION_MAP) {
      // Domain exceptions — mapped to HTTP status by exception class name
      statusCode = DOMAIN_EXCEPTION_MAP[exception.name];
      message = exception.message;
      error = (exception as Error & { code?: string }).code ?? exception.name;
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      error = 'Internal Server Error';

      // Log unexpected errors with full stack trace
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      // In local dev expose the real error — in production keep it generic
      if (process.env.ENV === 'local' || process.env.ENV === 'dev') {
        message =
          exception instanceof Error
            ? `[${exception.name}] ${exception.message}`
            : String(exception);
        error = exception instanceof Error ? exception.name : 'Internal Server Error';
      } else {
        message = 'Internal server error';
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.warn(
      `${request.method} ${request.url} -> ${statusCode}: ${JSON.stringify(message)}`,
    );

    response.status(statusCode).json(errorResponse);
  }
}

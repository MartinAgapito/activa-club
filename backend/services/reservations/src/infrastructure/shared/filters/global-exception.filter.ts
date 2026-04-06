import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  status: 'error';
  error: { code: string; message: string; details: unknown[] };
}

const DOMAIN_EXCEPTION_MAP: Record<string, { httpStatus: HttpStatus; code: string }> = {
  InvalidDateFormatException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'INVALID_DATE_FORMAT' },
  DateInPastException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'DATE_IN_PAST' },
  DateExceedsWindowException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'DATE_EXCEEDS_WINDOW' },
  MembershipInactiveException: { httpStatus: HttpStatus.FORBIDDEN, code: 'MEMBERSHIP_INACTIVE' },
  AreaNotAccessibleException: { httpStatus: HttpStatus.FORBIDDEN, code: 'AREA_NOT_ACCESSIBLE' },
  AreaNotFoundException: { httpStatus: HttpStatus.NOT_FOUND, code: 'AREA_NOT_FOUND' },
  InvalidStartTimeException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'INVALID_START_TIME' },
  DurationExceedsMaximumException: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'DURATION_EXCEEDS_MAXIMUM',
  },
  DurationNotMultipleException: {
    httpStatus: HttpStatus.BAD_REQUEST,
    code: 'DURATION_NOT_MULTIPLE',
  },
  WeeklyQuotaExceededException: { httpStatus: HttpStatus.FORBIDDEN, code: 'WEEKLY_QUOTA_EXCEEDED' },
  SlotFullException: { httpStatus: HttpStatus.CONFLICT, code: 'SLOT_FULL' },
  OverlapConflictException: { httpStatus: HttpStatus.CONFLICT, code: 'OVERLAP_CONFLICT' },
  ReservationNotFoundException: { httpStatus: HttpStatus.NOT_FOUND, code: 'RESERVATION_NOT_FOUND' },
  ForbiddenReservationException: { httpStatus: HttpStatus.FORBIDDEN, code: 'FORBIDDEN' },
  CancellationWindowClosedException: {
    httpStatus: HttpStatus.CONFLICT,
    code: 'CANCELLATION_WINDOW_CLOSED',
  },
  InvalidReservationStatusException: { httpStatus: HttpStatus.CONFLICT, code: 'INVALID_STATUS' },
  BlockNotFoundException: { httpStatus: HttpStatus.NOT_FOUND, code: 'BLOCK_NOT_FOUND' },
  BlockOverlapException: { httpStatus: HttpStatus.CONFLICT, code: 'BLOCK_OVERLAP' },
  InvalidBlockRangeException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'INVALID_BLOCK_RANGE' },
  ReasonRequiredException: { httpStatus: HttpStatus.BAD_REQUEST, code: 'REASON_REQUIRED' },
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { httpStatus, body } = this.buildErrorResponse(exception, request);
    response.status(httpStatus).json(body);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): { httpStatus: number; body: ErrorResponse } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as Record<string, unknown>;
      let code = 'HTTP_ERROR';
      let message = exception.message;
      let details: unknown[] = [];

      if (Array.isArray(res['message'])) {
        code = 'VALIDATION_ERROR';
        message = 'One or more fields failed validation.';
        details = res['message'] as string[];
      } else if (typeof res['message'] === 'string') {
        message = res['message'];
      }

      this.logger.warn(`HttpException: status=${status}, code=${code}, path=${request.url}`);
      return { httpStatus: status, body: { status: 'error', error: { code, message, details } } };
    }

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
      this.logger.error(
        `UnhandledException: ${exception.name} — ${exception.message}`,
        exception.stack,
      );
    }

    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.', details: [] },
      },
    };
  }
}

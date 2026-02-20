import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

/**
 * Logging interceptor.
 *
 * Logs incoming HTTP requests and their response times.
 * In production Lambda environments structured logging via @libs/logging
 * (AWS Lambda Powertools pattern) should complement this interceptor.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') ?? '';
    const startTime = Date.now();

    this.logger.log(`--> ${method} ${url} [${ip}] ${userAgent}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `<-- ${method} ${url} ${response.statusCode} [${duration}ms]`,
        );
      }),
    );
  }
}

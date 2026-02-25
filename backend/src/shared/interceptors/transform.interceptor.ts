import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

/**
 * Transform interceptor.
 *
 * Wraps all successful responses in a consistent envelope:
 *
 * {
 *   "data": <original response>,
 *   "timestamp": "<ISO 8601>"
 * }
 *
 * Controllers that return null/undefined (e.g. 204 No Content) are passed
 * through without wrapping.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        // Skip wrapping for empty responses (204 No Content)
        if (data === null || data === undefined) {
          return data as T;
        }

        return {
          data,
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<T>;
      }),
    );
  }
}

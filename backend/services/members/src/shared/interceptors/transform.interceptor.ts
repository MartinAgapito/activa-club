import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
}

/**
 * Transform interceptor — local dev copy.
 *
 * Mirrors backend/src/shared/interceptors/transform.interceptor.ts.
 * Registered in main.ts to keep local dev behaviour identical to the
 * deployed Lambda (which uses the same interceptor via lambda.ts).
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
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

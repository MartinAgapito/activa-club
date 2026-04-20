import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        if (data === null || data === undefined) {
          return data as T;
        }
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<T>;
      }),
    );
  }
}

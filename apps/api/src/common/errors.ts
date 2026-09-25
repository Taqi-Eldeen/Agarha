import { ERROR_CODES, type ErrorCode } from '@agarha/schemas';
import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error rendered as { code, message, details, requestId } by the global filter. */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode | string,
    status: HttpStatus,
    message: string = code,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  validation: (details: unknown) =>
    new AppError(
      ERROR_CODES.validation,
      HttpStatus.BAD_REQUEST,
      'Request validation failed',
      details,
    ),
  unauthorized: (message = 'Authentication required') =>
    new AppError(ERROR_CODES.unauthorized, HttpStatus.UNAUTHORIZED, message),
  forbidden: (message = 'Not allowed') =>
    new AppError(ERROR_CODES.forbidden, HttpStatus.FORBIDDEN, message),
  notFound: (what = 'Resource') =>
    new AppError(ERROR_CODES.notFound, HttpStatus.NOT_FOUND, `${what} not found`),
  conflict: (message: string, details?: unknown) =>
    new AppError(ERROR_CODES.conflict, HttpStatus.CONFLICT, message, details),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError(
      ERROR_CODES.rateLimited,
      HttpStatus.TOO_MANY_REQUESTS,
      'Too many requests',
      { retryAfterSeconds },
      {
        'Retry-After': String(retryAfterSeconds),
      },
    ),
  badRequest: (code: string, message: string, details?: unknown) =>
    new AppError(code, HttpStatus.BAD_REQUEST, message, details),
};

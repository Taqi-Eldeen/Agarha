import { ERROR_CODES } from '@agarha/schemas';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from './errors';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = String(req.id ?? '');

    if (exception instanceof AppError) {
      if (exception.headers) for (const [k, v] of Object.entries(exception.headers)) res.setHeader(k, v);
      res.status(exception.getStatus()).json({
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === 404 ? ERROR_CODES.notFound : status === 401 ? ERROR_CODES.unauthorized : status === 403 ? ERROR_CODES.forbidden : status === 429 ? ERROR_CODES.rateLimited : status >= 500 ? ERROR_CODES.internal : ERROR_CODES.validation;
      res.status(status).json({ code, message: exception.message, requestId });
      return;
    }
    this.logger.error({ err: exception, requestId }, 'Unhandled error');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ERROR_CODES.internal,
      message: 'Internal error',
      requestId,
    });
  }
}

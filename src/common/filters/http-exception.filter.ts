import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppError } from '../errors/app-error';
import { AppLogger } from '../logger/app-logger.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const { statusCode, body, level } = this.normalizeException(exception);

    this.logger[level]('Request failed', {
      path: request.url,
      method: request.method,
      statusCode,
      errorCode: body.code,
      details: body.details,
    });

    response.status(statusCode).json(body);
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        level: exception.statusCode >= 500 ? 'error' : 'warn',
        body: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      } as const;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : Array.isArray((payload as { message?: unknown }).message)
            ? (payload as { message: string[] }).message.join(', ')
            : ((payload as { message?: string }).message ?? exception.message);

      return {
        statusCode,
        level: statusCode >= 500 ? 'error' : 'warn',
        body: {
          code: 'HTTP_EXCEPTION',
          message,
        },
      } as const;
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      level: 'error',
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected internal server error',
      },
    } as const;
  }
}

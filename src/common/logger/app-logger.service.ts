import { Injectable } from '@nestjs/common';

import { RequestContextService } from '../context/request-context.service';
import { logger } from './logger';

type LogContext = Record<string, unknown> | undefined;

@Injectable()
export class AppLogger {
  constructor(private readonly requestContext: RequestContextService) {}

  info(message: string, context?: LogContext) {
    logger.info(this.toLogArgs(context), message);
  }

  warn(message: string, context?: LogContext) {
    logger.warn(this.toLogArgs(context), message);
  }

  error(message: string, context?: LogContext) {
    logger.error(this.toLogArgs(context), message);
  }

  child(bindings: Record<string, unknown>) {
    const childLogger = logger.child(bindings);

    return {
      info: (message: string, context?: LogContext) =>
        childLogger.info(this.toLogArgs(context), message),
      warn: (message: string, context?: LogContext) =>
        childLogger.warn(this.toLogArgs(context), message),
      error: (message: string, context?: LogContext) =>
        childLogger.error(this.toLogArgs(context), message),
    };
  }

  private toLogArgs(context?: LogContext) {
    const requestId = this.requestContext.getRequestId();

    if (!requestId) {
      return context ?? {};
    }

    return {
      requestId,
      ...(context ?? {}),
    };
  }
}

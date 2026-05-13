import { Global, Module } from '@nestjs/common';

import { RequestContextService } from './context/request-context.service';
import { AppLogger } from './logger/app-logger.service';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

@Global()
@Module({
  providers: [RequestContextService, AppLogger, RequestIdMiddleware],
  exports: [RequestContextService, AppLogger, RequestIdMiddleware],
})
export class CommonModule {}

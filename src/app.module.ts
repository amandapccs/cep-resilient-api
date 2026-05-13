import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CepModule } from './modules/cep/cep.module';

@Module({
  imports: [CommonModule, CepModule],
  providers: [HttpExceptionFilter],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { NODE_ENV, SWAGGER_VALID_ENVS } from './config/default';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';
import { setupSwagger } from './docs/setup-swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  const logger = app.get(AppLogger);

  app.useGlobalFilters(new HttpExceptionFilter(logger));

  if (SWAGGER_VALID_ENVS.includes(NODE_ENV)) {
    await setupSwagger(app);
  }

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  logger.info('Application started', {
    port,
  });
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';

  process.stderr.write(`${message}\n`);
  process.exit(1);
});

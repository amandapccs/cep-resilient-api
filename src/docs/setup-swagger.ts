import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { swaggerOptions } from './options';

type ScalarModule = typeof import('@scalar/express-api-reference');

type SetupSwaggerOptions = {
  enableScalar?: boolean;
};

export async function setupSwagger(
  app: INestApplication,
  options: SetupSwaggerOptions = {},
) {
  const { enableScalar = true } = options;
  const config = new DocumentBuilder()
    .setTitle('CEP Resilient API')
    .setDescription(
      'API para consulta de CEP com fallback automatico entre providers externos e contrato de resposta unificado.',
    )
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  instance.get('/openapi.json', (_request: unknown, response: { json: (body: unknown) => void }) => {
    response.json(document);
  });

  if (!enableScalar) {
    return;
  }

  const { apiReference } = (await loadScalarModule()) as ScalarModule;

  instance.use('/internal/docs', apiReference({ ...swaggerOptions, url: '/openapi.json' }));
  instance.use('/v1/docs', apiReference({ ...swaggerOptions, url: '/openapi.json' }));
}

function loadScalarModule() {
  const dynamicImport = new Function(
    'specifier',
    'return import(specifier)',
  ) as (specifier: string) => Promise<unknown>;

  return dynamicImport('@scalar/express-api-reference');
}

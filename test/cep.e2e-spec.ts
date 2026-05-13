import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AppLogger } from '../src/common/logger/app-logger.service';
import { setupSwagger } from '../src/docs/setup-swagger';
import { BrasilApiProvider } from '../src/modules/cep/providers/brasil-api.provider';
import { ViaCepProvider } from '../src/modules/cep/providers/via-cep.provider';

describe('CepController (e2e)', () => {
  let app: INestApplication;

  const viaCepProvider = {
    lookup: jest.fn(),
  };

  const brasilApiProvider = {
    lookup: jest.fn(),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';

    viaCepProvider.lookup.mockReset();
    brasilApiProvider.lookup.mockReset();
    logger.info.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ViaCepProvider)
      .useValue(viaCepProvider)
      .overrideProvider(BrasilApiProvider)
      .useValue(brasilApiProvider)
      .overrideProvider(AppLogger)
      .useValue(logger)
      .compile();

    app = moduleRef.createNestApplication({
      logger: false,
    });
    app.useGlobalFilters(new HttpExceptionFilter(logger as unknown as AppLogger));
    await setupSwagger(app, { enableScalar: false });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a normalized CEP contract', async () => {
    viaCepProvider.lookup.mockResolvedValue({
      cep: '01310930',
      state: 'SP',
      city: 'Sao Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
      provider: 'via-cep',
    });

    await request(app.getHttpServer())
      .get('/cep/01310-930')
      .expect(200)
      .expect({
        cep: '01310930',
        state: 'SP',
        city: 'Sao Paulo',
        neighborhood: 'Bela Vista',
        street: 'Avenida Paulista',
        provider: 'via-cep',
      });
  });

  it('returns the request id header and preserves a caller-provided value', async () => {
    viaCepProvider.lookup.mockResolvedValue({
      cep: '01310930',
      state: 'SP',
      city: 'Sao Paulo',
      neighborhood: 'Bela Vista',
      street: 'Avenida Paulista',
      provider: 'via-cep',
    });

    const response = await request(app.getHttpServer())
      .get('/cep/01310-930')
      .set('x-request-id', 'req-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('req-123');
  });

  it('returns 400 for invalid CEP input', async () => {
    await request(app.getHttpServer())
      .get('/cep/123')
      .expect(400)
      .expect({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          issues: [
            {
              path: 'cep',
              message: 'CEP must contain exactly 8 digits',
            },
          ],
        },
      });
  });

  it('exposes the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json').expect(200);

    expect(response.body.info.title).toBe('CEP Resilient API');
    expect(response.body.paths['/cep/{cep}']).toBeDefined();
  });
});

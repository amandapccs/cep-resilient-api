import {
  CepNotFoundError,
  CepProvidersTimeoutError,
  CepProvidersUnavailableError,
  InvalidCepError,
} from '../src/common/errors/cep.errors';
import { AppLogger } from '../src/common/logger/app-logger.service';
import { CepCacheService } from '../src/modules/cep/cache/cep-cache.service';
import { CepService } from '../src/modules/cep/cep.service';
import type { CepResponseDto } from '../src/modules/cep/dto/cep-response.dto';
import { BrasilApiProvider } from '../src/modules/cep/providers/brasil-api.provider';
import { ProviderError } from '../src/modules/cep/providers/provider.error';
import { ProviderCircuitBreakerService } from '../src/modules/cep/resilience/provider-circuit-breaker.service';
import { ProviderRotatorService } from '../src/modules/cep/strategy/provider-rotator.service';
import { ViaCepProvider } from '../src/modules/cep/providers/via-cep.provider';

describe('CepService', () => {
  const successResponse: CepResponseDto = {
    cep: '01310930',
    state: 'SP',
    city: 'Sao Paulo',
    neighborhood: 'Bela Vista',
    street: 'Avenida Paulista',
    provider: 'via-cep',
  };

  let viaCepProvider: { lookup: jest.Mock };
  let brasilApiProvider: { lookup: jest.Mock };
  let providerRotator: { orderProviders: jest.Mock };
  let cepCache: { getFresh: jest.Mock; getStale: jest.Mock; set: jest.Mock };
  let circuitBreaker: {
    prioritizeProviders: jest.Mock;
    recordSuccess: jest.Mock;
    recordFailure: jest.Mock;
    getSnapshot: jest.Mock;
  };
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let service: CepService;

  beforeEach(() => {
    viaCepProvider = {
      lookup: jest.fn(),
    };

    brasilApiProvider = {
      lookup: jest.fn(),
    };

    providerRotator = {
      orderProviders: jest.fn().mockReturnValue(['via-cep', 'brasil-api']),
    };

    cepCache = {
      getFresh: jest.fn().mockReturnValue(null),
      getStale: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };

    circuitBreaker = {
      prioritizeProviders: jest
        .fn()
        .mockImplementation((providers: Array<'via-cep' | 'brasil-api'>) => providers),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      getSnapshot: jest.fn().mockReturnValue({
        state: 'closed',
        consecutiveFailures: 0,
      }),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new CepService(
      viaCepProvider as unknown as ViaCepProvider,
      brasilApiProvider as unknown as BrasilApiProvider,
      providerRotator as unknown as ProviderRotatorService,
      cepCache as unknown as CepCacheService,
      circuitBreaker as unknown as ProviderCircuitBreakerService,
      logger as unknown as AppLogger,
    );
  });

  it('returns a fresh cache hit without calling providers', async () => {
    cepCache.getFresh.mockReturnValue({
      value: successResponse,
      cachedAt: Date.now(),
      ageMs: 50,
    });

    await expect(service.getCep('01310930')).resolves.toEqual(successResponse);

    expect(viaCepProvider.lookup).not.toHaveBeenCalled();
    expect(brasilApiProvider.lookup).not.toHaveBeenCalled();
  });

  it('returns the first provider response when it succeeds', async () => {
    viaCepProvider.lookup.mockResolvedValue(successResponse);

    await expect(service.getCep('01310930')).resolves.toEqual(successResponse);

    expect(viaCepProvider.lookup).toHaveBeenCalledWith('01310930');
    expect(brasilApiProvider.lookup).not.toHaveBeenCalled();
    expect(cepCache.set).toHaveBeenCalledWith('01310930', successResponse);
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('via-cep');
  });

  it('falls back to the second provider when the first is unavailable', async () => {
    const brasilApiResponse = {
      ...successResponse,
      provider: 'brasil-api' as const,
    };

    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'unavailable', 'ViaCEP is unavailable'),
    );
    brasilApiProvider.lookup.mockResolvedValue(brasilApiResponse);

    await expect(service.getCep('01310930')).resolves.toEqual(brasilApiResponse);

    expect(viaCepProvider.lookup).toHaveBeenCalledTimes(1);
    expect(brasilApiProvider.lookup).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalled();
    expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('via-cep', 'unavailable');
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('brasil-api');
  });

  it('throws not found when both providers report the CEP as missing', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'not_found', 'CEP not found in ViaCEP'),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'not_found', 'CEP not found in BrasilAPI'),
    );

    await expect(service.getCep('01310930')).rejects.toBeInstanceOf(CepNotFoundError);
  });

  it('throws timeout when all providers time out', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'timeout', 'ViaCEP timed out'),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'timeout', 'BrasilAPI timed out'),
    );

    await expect(service.getCep('01310930')).rejects.toBeInstanceOf(CepProvidersTimeoutError);
  });

  it('throws rate limited when all providers return 429', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'rate_limited', 'ViaCEP rate limited', {
        statusCode: 429,
        retryAfterSeconds: 60,
      }),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'rate_limited', 'BrasilAPI rate limited', {
        statusCode: 429,
      }),
    );

    await expect(service.getCep('01310930')).rejects.toMatchObject({
      code: 'CEP_PROVIDERS_RATE_LIMITED',
      statusCode: 503,
    });
  });

  it('throws service unavailable when rate limit is mixed with other failures', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'rate_limited', 'ViaCEP rate limited', { statusCode: 429 }),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'unavailable', 'BrasilAPI is unavailable'),
    );

    await expect(service.getCep('01310930')).rejects.toBeInstanceOf(CepProvidersUnavailableError);
  });

  it('throws service unavailable when not_found is mixed with unavailable', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'not_found', 'CEP not found in ViaCEP'),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'unavailable', 'BrasilAPI is unavailable'),
    );

    await expect(service.getCep('01310930')).rejects.toBeInstanceOf(
      CepProvidersUnavailableError,
    );
  });

  it('serves stale cache when providers fail', async () => {
    viaCepProvider.lookup.mockRejectedValue(
      new ProviderError('via-cep', 'timeout', 'ViaCEP timed out'),
    );
    brasilApiProvider.lookup.mockRejectedValue(
      new ProviderError('brasil-api', 'unavailable', 'BrasilAPI is unavailable'),
    );
    cepCache.getStale.mockReturnValue({
      value: successResponse,
      cachedAt: Date.now() - 1000,
      ageMs: 1000,
    });

    await expect(service.getCep('01310930')).resolves.toEqual(successResponse);

    expect(logger.warn).toHaveBeenCalledWith(
      'Serving stale CEP from cache after provider failure',
      expect.objectContaining({
        cep: '01310930',
        cacheStatus: 'stale',
      }),
    );
  });

  it('skips providers filtered out by the circuit breaker', async () => {
    const brasilApiResponse = {
      ...successResponse,
      provider: 'brasil-api' as const,
    };

    circuitBreaker.prioritizeProviders.mockReturnValue(['brasil-api']);
    brasilApiProvider.lookup.mockResolvedValue(brasilApiResponse);

    await expect(service.getCep('01310930')).resolves.toEqual(brasilApiResponse);

    expect(viaCepProvider.lookup).not.toHaveBeenCalled();
    expect(brasilApiProvider.lookup).toHaveBeenCalledWith('01310930');
  });

  it('rejects invalid CEP input before calling providers', async () => {
    await expect(service.getCep('123')).rejects.toBeInstanceOf(InvalidCepError);

    expect(viaCepProvider.lookup).not.toHaveBeenCalled();
    expect(brasilApiProvider.lookup).not.toHaveBeenCalled();
  });
});

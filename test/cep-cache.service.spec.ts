import { CepCacheService } from '../src/modules/cep/cache/cep-cache.service';
import type { CepResponseDto } from '../src/modules/cep/dto/cep-response.dto';

describe('CepCacheService', () => {
  const response: CepResponseDto = {
    cep: '01310930',
    state: 'SP',
    city: 'Sao Paulo',
    neighborhood: 'Bela Vista',
    street: 'Avenida Paulista',
    provider: 'via-cep',
  };

  beforeEach(() => {
    process.env.CEP_CACHE_TTL_MS = '1000';
    process.env.CEP_CACHE_STALE_TTL_MS = '2000';
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.CEP_CACHE_TTL_MS;
    delete process.env.CEP_CACHE_STALE_TTL_MS;
  });

  it('returns a fresh cache hit while inside the fresh ttl', () => {
    const service = new CepCacheService();

    service.set('01310930', response);

    const entry = service.getFresh('01310930');

    expect(entry?.value).toEqual(response);
    expect(entry?.ageMs).toBe(0);
  });

  it('returns stale cache only after the fresh ttl expires', () => {
    const service = new CepCacheService();

    service.set('01310930', response);
    jest.advanceTimersByTime(1500);

    expect(service.getFresh('01310930')).toBeNull();
    expect(service.getStale('01310930')?.value).toEqual(response);
  });

  it('evicts cache entries after the stale window expires', () => {
    const service = new CepCacheService();

    service.set('01310930', response);
    jest.advanceTimersByTime(3500);

    expect(service.getFresh('01310930')).toBeNull();
    expect(service.getStale('01310930')).toBeNull();
  });
});

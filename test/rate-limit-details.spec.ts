import { buildRateLimitDetails } from '../src/modules/cep/providers/rate-limit-details';

describe('buildRateLimitDetails', () => {
  it('parses numeric Retry-After as seconds', () => {
    const headers = new Headers();
    headers.set('retry-after', '120');

    const response = { status: 429, headers } as Response;

    expect(buildRateLimitDetails(response)).toEqual({
      statusCode: 429,
      retryAfterSeconds: 120,
    });
  });

  it('passes through non-numeric Retry-After as raw string', () => {
    const headers = new Headers();
    headers.set('retry-after', 'Wed, 21 Oct 2026 07:28:00 GMT');

    const response = { status: 429, headers } as Response;

    expect(buildRateLimitDetails(response)).toEqual({
      statusCode: 429,
      retryAfter: 'Wed, 21 Oct 2026 07:28:00 GMT',
    });
  });

  it('returns only statusCode when Retry-After is absent', () => {
    const headers = new Headers();
    const response = { status: 429, headers } as Response;

    expect(buildRateLimitDetails(response)).toEqual({ statusCode: 429 });
  });
});

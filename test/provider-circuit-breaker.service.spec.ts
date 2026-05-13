import { ProviderCircuitBreakerService } from '../src/modules/cep/resilience/provider-circuit-breaker.service';

describe('ProviderCircuitBreakerService', () => {
  beforeEach(() => {
    process.env.CEP_CIRCUIT_BREAKER_FAILURE_THRESHOLD = '2';
    process.env.CEP_CIRCUIT_BREAKER_RESET_TIMEOUT_MS = '1000';
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.CEP_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
    delete process.env.CEP_CIRCUIT_BREAKER_RESET_TIMEOUT_MS;
  });

  it('opens the circuit when rate limited failures reach the threshold', () => {
    const service = new ProviderCircuitBreakerService();

    service.recordFailure('via-cep', 'rate_limited');
    service.recordFailure('via-cep', 'rate_limited');

    expect(service.getSnapshot('via-cep').state).toBe('open');
  });

  it('opens the circuit after reaching the failure threshold', () => {
    const service = new ProviderCircuitBreakerService();

    service.recordFailure('via-cep', 'timeout');
    service.recordFailure('via-cep', 'unavailable');

    expect(service.getSnapshot('via-cep').state).toBe('open');
    expect(service.prioritizeProviders(['via-cep', 'brasil-api'])).toEqual(['brasil-api']);
  });

  it('moves the circuit to half-open after the reset timeout', () => {
    const service = new ProviderCircuitBreakerService();

    service.recordFailure('via-cep', 'timeout');
    service.recordFailure('via-cep', 'timeout');
    jest.advanceTimersByTime(1000);

    expect(service.getSnapshot('via-cep').state).toBe('half-open');
    expect(service.prioritizeProviders(['via-cep', 'brasil-api'])).toEqual([
      'brasil-api',
      'via-cep',
    ]);
  });

  it('does not count not found as a provider failure', () => {
    const service = new ProviderCircuitBreakerService();

    service.recordFailure('via-cep', 'timeout');
    service.recordFailure('via-cep', 'not_found');

    expect(service.getSnapshot('via-cep').state).toBe('closed');
    expect(service.getSnapshot('via-cep').consecutiveFailures).toBe(0);
  });
});

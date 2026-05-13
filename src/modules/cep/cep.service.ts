import { Injectable } from '@nestjs/common';

import {
  CepNotFoundError,
  CepProvidersRateLimitedError,
  CepProvidersTimeoutError,
  CepProvidersUnavailableError,
  InvalidCepError,
} from '../../common/errors/cep.errors';
import { AppLogger } from '../../common/logger/app-logger.service';
import { CepCacheService } from './cache/cep-cache.service';
import type { CepResponseDto } from './dto/cep-response.dto';
import type {
  CepProvider,
  ProviderFailureCategory,
  ProviderName,
} from './providers/cep-provider.interface';
import { ProviderError } from './providers/provider.error';
import { BrasilApiProvider } from './providers/brasil-api.provider';
import { ViaCepProvider } from './providers/via-cep.provider';
import { ProviderCircuitBreakerService } from './resilience/provider-circuit-breaker.service';
import { ProviderRotatorService } from './strategy/provider-rotator.service';

type ProviderAttemptError = {
  provider: ProviderName;
  category: ProviderFailureCategory;
  message: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class CepService {
  private readonly providers: Record<ProviderName, CepProvider>;

  constructor(
    private readonly viaCepProvider: ViaCepProvider,
    private readonly brasilApiProvider: BrasilApiProvider,
    private readonly providerRotator: ProviderRotatorService,
    private readonly cepCache: CepCacheService,
    private readonly circuitBreaker: ProviderCircuitBreakerService,
    private readonly logger: AppLogger,
  ) {
    this.providers = {
      'via-cep': this.viaCepProvider,
      'brasil-api': this.brasilApiProvider,
    };
  }

  async getCep(cep: string): Promise<CepResponseDto> {
    if (!/^\d{8}$/.test(cep)) {
      throw new InvalidCepError(cep);
    }

    const cachedEntry = this.cepCache.getFresh(cep);

    if (cachedEntry) {
      this.logger.info('Returning CEP from fresh cache', {
        cep,
        cacheStatus: 'hit',
        cacheAgeMs: cachedEntry.ageMs,
        cachedAt: cachedEntry.cachedAt,
      });

      return cachedEntry.value;
    }

    const initialProviderOrder = this.providerRotator.orderProviders(['via-cep', 'brasil-api']);
    const providerOrder = this.circuitBreaker.prioritizeProviders(initialProviderOrder);
    const skippedProviders = initialProviderOrder
      .filter((providerName) => !providerOrder.includes(providerName))
      .map((providerName) => ({
        provider: providerName,
        circuitState: this.circuitBreaker.getSnapshot(providerName).state,
      }));
    const errors: ProviderAttemptError[] = [];

    this.logger.info('Starting CEP lookup', {
      cep,
      cacheStatus: 'miss',
      initialProviderOrder,
      providerOrder,
      skippedProviders,
    });

    for (const providerName of providerOrder) {
      const provider = this.providers[providerName];
      const startedAt = Date.now();

      try {
        const result = await provider.lookup(cep);
        this.circuitBreaker.recordSuccess(providerName);
        this.cepCache.set(cep, result);

        this.logger.info('CEP lookup succeeded', {
          cep,
          provider: providerName,
          durationMs: Date.now() - startedAt,
          cacheStatus: 'refreshed',
          circuitState: this.circuitBreaker.getSnapshot(providerName).state,
        });

        return result;
      } catch (error) {
        if (!(error instanceof ProviderError)) {
          throw error;
        }

        this.circuitBreaker.recordFailure(providerName, error.category);
        const circuitSnapshot = this.circuitBreaker.getSnapshot(providerName);

        const attemptError: ProviderAttemptError = {
          provider: providerName,
          category: error.category,
          message: error.message,
          details: error.details,
        };

        errors.push(attemptError);

        this.logger.warn('CEP provider failed, trying fallback when available', {
          cep,
          provider: providerName,
          category: error.category,
          durationMs: Date.now() - startedAt,
          details: error.details,
          fallbackTriggered: errors.length < providerOrder.length,
          circuitState: circuitSnapshot.state,
          consecutiveFailures: circuitSnapshot.consecutiveFailures,
        });
      }
    }

    const staleEntry = this.cepCache.getStale(cep);
    const finalError = this.toFinalError(cep, errors, skippedProviders);
    
    if (staleEntry) {
      this.logger.warn('Serving stale CEP from cache after provider failure', {
        cep,
        cacheStatus: 'stale',
        cacheAgeMs: staleEntry.ageMs,
        cachedAt: staleEntry.cachedAt,
        finalCode: finalError.code,
        errors,
      });
      
      return staleEntry.value;
    }

    this.logger.error('CEP lookup failed after exhausting providers', {
      cep,
      providerOrder,
      skippedProviders,
      finalCode: finalError.code,
      errors,
    });

    throw finalError;
  }

  private toFinalError(
    cep: string,
    errors: ProviderAttemptError[],
    skippedProviders: Array<{ provider: ProviderName; circuitState: string }>,
  ) {
    const details = {
      providerErrors: errors,
      skippedProviders,
    };

    if (errors.length > 0 && errors.every((error) => error.category === 'not_found')) {
      return new CepNotFoundError(cep, details);
    }

    if (errors.length > 0 && errors.every((error) => error.category === 'timeout')) {
      return new CepProvidersTimeoutError(cep, details);
    }

    if (errors.length > 0 && errors.every((error) => error.category === 'rate_limited')) {
      return new CepProvidersRateLimitedError(cep, details);
    }

    return new CepProvidersUnavailableError(cep, details);
  }
}

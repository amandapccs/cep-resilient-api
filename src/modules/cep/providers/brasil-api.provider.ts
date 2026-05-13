import { Injectable } from '@nestjs/common';

import { CepMapper } from '../mappers/cep.mapper';
import type { CepProvider, ProviderLookupResult } from './cep-provider.interface';
import { ProviderError } from './provider.error';
import { buildRateLimitDetails } from './rate-limit-details';

type BrasilApiResponse = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
};

@Injectable()
export class BrasilApiProvider implements CepProvider {
  readonly name = 'brasil-api' as const;

  constructor(private readonly cepMapper: CepMapper) {}

  async lookup(cep: string): Promise<ProviderLookupResult> {
    const timeoutInMs = Number(process.env.CEP_PROVIDER_TIMEOUT_MS ?? 2000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutInMs);

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
        signal: controller.signal,
      });

      if (response.status === 404) {
        throw new ProviderError(this.name, 'not_found', 'CEP not found in BrasilAPI');
      }

      if (response.status === 429) {
        throw new ProviderError(
          this.name,
          'rate_limited',
          'BrasilAPI rate limited the request',
          buildRateLimitDetails(response),
        );
      }

      if (!response.ok) {
        throw new ProviderError(this.name, 'unavailable', 'BrasilAPI returned a non-success status code', {
          statusCode: response.status,
        });
      }

      const payload = (await response.json()) as BrasilApiResponse;

      if (!payload.cep || !payload.state || !payload.city) {
        throw new ProviderError(this.name, 'unavailable', 'BrasilAPI returned an incomplete payload');
      }

      return this.cepMapper.fromBrasilApi({
        cep: payload.cep,
        state: payload.state,
        city: payload.city,
        neighborhood: payload.neighborhood ?? '',
        street: payload.street ?? '',
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError(this.name, 'timeout', 'BrasilAPI request timed out', {
          timeoutInMs,
        });
      }

      throw new ProviderError(this.name, 'unavailable', 'BrasilAPI request failed', {
        cause: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

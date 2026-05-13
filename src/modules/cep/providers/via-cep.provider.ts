import { Injectable } from '@nestjs/common';

import { CepMapper } from '../mappers/cep.mapper';
import type { CepProvider, ProviderLookupResult } from './cep-provider.interface';
import { ProviderError } from './provider.error';
import { buildRateLimitDetails } from './rate-limit-details';

type ViaCepApiResponse = {
  cep?: string;
  uf?: string;
  localidade?: string;
  bairro?: string;
  logradouro?: string;
  erro?: boolean;
};

@Injectable()
export class ViaCepProvider implements CepProvider {
  readonly name = 'via-cep' as const;

  constructor(private readonly cepMapper: CepMapper) {}

  async lookup(cep: string): Promise<ProviderLookupResult> {
    const timeoutInMs = Number(process.env.CEP_PROVIDER_TIMEOUT_MS ?? 2000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutInMs);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new ProviderError(
          this.name,
          'rate_limited',
          'ViaCEP rate limited the request',
          buildRateLimitDetails(response),
        );
      }

      if (!response.ok) {
        throw new ProviderError(this.name, 'unavailable', 'ViaCEP returned a non-success status code', {
          statusCode: response.status,
        });
      }

      const payload = (await response.json()) as ViaCepApiResponse;

      if (payload.erro) {
        throw new ProviderError(this.name, 'not_found', 'CEP not found in ViaCEP');
      }

      if (!payload.cep || !payload.uf || !payload.localidade) {
        throw new ProviderError(this.name, 'unavailable', 'ViaCEP returned an incomplete payload');
      }

      return this.cepMapper.fromViaCep({
        cep: payload.cep,
        uf: payload.uf,
        localidade: payload.localidade,
        bairro: payload.bairro ?? '',
        logradouro: payload.logradouro ?? '',
      });
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError(this.name, 'timeout', 'ViaCEP request timed out', {
          timeoutInMs,
        });
      }

      throw new ProviderError(this.name, 'unavailable', 'ViaCEP request failed', {
        cause: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

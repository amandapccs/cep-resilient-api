import type { CepResponseDto } from '../dto/cep-response.dto';

export type ProviderName = 'via-cep' | 'brasil-api';

export type ProviderFailureCategory =
  | 'not_found'
  | 'timeout'
  | 'unavailable'
  | 'rate_limited';

export type ProviderLookupResult = CepResponseDto;

export interface CepProvider {
  readonly name: ProviderName;
  lookup(cep: string): Promise<ProviderLookupResult>;
}

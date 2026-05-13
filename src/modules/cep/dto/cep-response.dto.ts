import type { ProviderName } from '../providers/cep-provider.interface';

export type CepResponseDto = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  provider: ProviderName;
};

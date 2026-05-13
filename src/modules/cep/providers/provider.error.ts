import type { ProviderFailureCategory, ProviderName } from './cep-provider.interface';

export class ProviderError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly category: ProviderFailureCategory,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

import { Injectable } from '@nestjs/common';

import type { ProviderName } from '../providers/cep-provider.interface';

@Injectable()
export class ProviderRotatorService {
  private currentIndex = 0;

  orderProviders(providerNames: ProviderName[]) {
    if (providerNames.length <= 1) {
      return providerNames;
    }

    const startIndex = this.currentIndex % providerNames.length;
    this.currentIndex = (this.currentIndex + 1) % providerNames.length;

    return [
      ...providerNames.slice(startIndex),
      ...providerNames.slice(0, startIndex),
    ];
  }
}

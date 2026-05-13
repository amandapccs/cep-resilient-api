import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { CepController } from './cep.controller';
import { CepService } from './cep.service';
import { CepCacheService } from './cache/cep-cache.service';
import { CepMapper } from './mappers/cep.mapper';
import { BrasilApiProvider } from './providers/brasil-api.provider';
import { ViaCepProvider } from './providers/via-cep.provider';
import { ProviderCircuitBreakerService } from './resilience/provider-circuit-breaker.service';
import { ProviderRotatorService } from './strategy/provider-rotator.service';

@Module({
  imports: [CommonModule],
  controllers: [CepController],
  providers: [
    CepService,
    CepCacheService,
    CepMapper,
    ViaCepProvider,
    BrasilApiProvider,
    ProviderCircuitBreakerService,
    ProviderRotatorService,
  ],
})
export class CepModule {}

import { Injectable } from '@nestjs/common';

import type { ProviderFailureCategory, ProviderName } from '../providers/cep-provider.interface';

type CircuitState = 'closed' | 'open' | 'half-open';

type ProviderCircuit = {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: number;
};

type ProviderCircuitSnapshot = {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: number;
};

@Injectable()
export class ProviderCircuitBreakerService {
  private readonly failureThreshold = Number(
    process.env.CEP_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? 3,
  );
  private readonly resetTimeoutMs = Number(
    process.env.CEP_CIRCUIT_BREAKER_RESET_TIMEOUT_MS ?? 30 * 1000,
  );
  private readonly circuits = new Map<ProviderName, ProviderCircuit>();

  prioritizeProviders(providerOrder: ProviderName[]) {
    const closedProviders: ProviderName[] = [];
    const halfOpenProviders: ProviderName[] = [];

    for (const providerName of providerOrder) {
      const state = this.getState(providerName);

      if (state === 'closed') {
        closedProviders.push(providerName);
      }

      if (state === 'half-open') {
        halfOpenProviders.push(providerName);
      }
    }

    return [...closedProviders, ...halfOpenProviders];
  }

  recordSuccess(providerName: ProviderName) {
    this.circuits.set(providerName, {
      state: 'closed',
      consecutiveFailures: 0,
    });
  }

  recordFailure(providerName: ProviderName, category: ProviderFailureCategory) {
    if (category === 'not_found') {
      this.recordSuccess(providerName);
      return;
    }

    const circuit = this.getOrCreateCircuit(providerName);
    const currentState = this.getState(providerName);

    if (currentState === 'half-open') {
      circuit.state = 'open';
      circuit.openedAt = Date.now();
      circuit.consecutiveFailures = this.failureThreshold;
      return;
    }

    circuit.consecutiveFailures += 1;

    if (circuit.consecutiveFailures >= this.failureThreshold) {
      circuit.state = 'open';
      circuit.openedAt = Date.now();
    }
  }

  getSnapshot(providerName: ProviderName): ProviderCircuitSnapshot {
    const circuit = this.getOrCreateCircuit(providerName);
    const state = this.getState(providerName);

    return {
      state,
      consecutiveFailures: circuit.consecutiveFailures,
      openedAt: circuit.openedAt,
    };
  }

  private getState(providerName: ProviderName): CircuitState {
    const circuit = this.getOrCreateCircuit(providerName);

    if (
      circuit.state === 'open' &&
      circuit.openedAt !== undefined &&
      Date.now() - circuit.openedAt >= this.resetTimeoutMs
    ) {
      circuit.state = 'half-open';
    }

    return circuit.state;
  }

  private getOrCreateCircuit(providerName: ProviderName) {
    const existingCircuit = this.circuits.get(providerName);

    if (existingCircuit) {
      return existingCircuit;
    }

    const circuit: ProviderCircuit = {
      state: 'closed',
      consecutiveFailures: 0,
    };

    this.circuits.set(providerName, circuit);

    return circuit;
  }
}

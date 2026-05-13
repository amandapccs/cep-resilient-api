import { Injectable } from '@nestjs/common';

import type { CepResponseDto } from '../dto/cep-response.dto';

type CepCacheEntry = {
  value: CepResponseDto;
  cachedAt: number;
  freshUntil: number;
  staleUntil: number;
};

type CepCacheHit = {
  value: CepResponseDto;
  cachedAt: number;
  ageMs: number;
};

@Injectable()
export class CepCacheService {
  private readonly entries = new Map<string, CepCacheEntry>();
  private readonly freshTtlMs = Number(process.env.CEP_CACHE_TTL_MS ?? 5 * 60 * 1000);
  private readonly staleTtlMs = Number(process.env.CEP_CACHE_STALE_TTL_MS ?? 60 * 60 * 1000);

  getFresh(cep: string): CepCacheHit | null {
    const entry = this.entries.get(cep);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    if (now > entry.staleUntil) {
      this.entries.delete(cep);
      return null;
    }

    if (now > entry.freshUntil) {
      return null;
    }

    return {
      value: entry.value,
      cachedAt: entry.cachedAt,
      ageMs: now - entry.cachedAt,
    };
  }

  getStale(cep: string): CepCacheHit | null {
    const entry = this.entries.get(cep);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    if (now > entry.staleUntil) {
      this.entries.delete(cep);
      return null;
    }

    if (now <= entry.freshUntil) {
      return null;
    }

    return {
      value: entry.value,
      cachedAt: entry.cachedAt,
      ageMs: now - entry.cachedAt,
    };
  }

  set(cep: string, value: CepResponseDto) {
    const now = Date.now();

    this.entries.set(cep, {
      value,
      cachedAt: now,
      freshUntil: now + this.freshTtlMs,
      staleUntil: now + this.freshTtlMs + this.staleTtlMs,
    });
  }
}

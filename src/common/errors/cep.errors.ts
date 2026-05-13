import { HttpStatus } from '@nestjs/common';

import { AppError } from './app-error';

export class InvalidCepError extends AppError {
  constructor(cep: string) {
    super('INVALID_CEP', HttpStatus.BAD_REQUEST, 'CEP must contain exactly 8 digits', {
      cep,
    });
  }
}

export class CepNotFoundError extends AppError {
  constructor(cep: string, details?: Record<string, unknown>) {
    super('CEP_NOT_FOUND', HttpStatus.NOT_FOUND, 'CEP was not found in the configured providers', {
      cep,
      ...details,
    });
  }
}

export class CepProvidersUnavailableError extends AppError {
  constructor(cep: string, details?: Record<string, unknown>) {
    super(
      'CEP_PROVIDERS_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      'All CEP providers are temporarily unavailable',
      {
        cep,
        ...details,
      },
    );
  }
}

export class CepProvidersTimeoutError extends AppError {
  constructor(cep: string, details?: Record<string, unknown>) {
    super(
      'CEP_PROVIDERS_TIMEOUT',
      HttpStatus.GATEWAY_TIMEOUT,
      'All CEP provider attempts timed out',
      {
        cep,
        ...details,
      },
    );
  }
}

export class CepProvidersRateLimitedError extends AppError {
  constructor(cep: string, details?: Record<string, unknown>) {
    super(
      'CEP_PROVIDERS_RATE_LIMITED',
      HttpStatus.SERVICE_UNAVAILABLE,
      'All CEP providers are rate limiting requests',
      {
        cep,
        ...details,
      },
    );
  }
}

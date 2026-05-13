import { Injectable } from '@nestjs/common';

import type { CepResponseDto } from '../dto/cep-response.dto';

type ViaCepResponse = {
  cep: string;
  uf: string;
  localidade: string;
  bairro: string;
  logradouro: string;
};

type BrasilApiResponse = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
};

@Injectable()
export class CepMapper {
  fromViaCep(payload: ViaCepResponse): CepResponseDto {
    return {
      cep: payload.cep.replace(/\D/g, ''),
      state: payload.uf,
      city: payload.localidade,
      neighborhood: payload.bairro,
      street: payload.logradouro,
      provider: 'via-cep',
    };
  }

  fromBrasilApi(payload: BrasilApiResponse): CepResponseDto {
    return {
      cep: payload.cep.replace(/\D/g, ''),
      state: payload.state,
      city: payload.city,
      neighborhood: payload.neighborhood,
      street: payload.street,
      provider: 'brasil-api',
    };
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { CepParamDto } from './dto/cep-param.dto';
import type { CepResponseDto } from './dto/cep-response.dto';
import { CepService } from './cep.service';
import { cepParamSchema } from './validation/cep-param.schema';

@ApiTags('CEP')
@Controller('cep')
export class CepController {
  constructor(private readonly cepService: CepService) {}

  @ApiOperation({
    summary: 'Consulta um CEP com fallback automatico entre providers',
  })
  @ApiParam({
    name: 'cep',
    description: 'CEP com 8 digitos, com ou sem pontuacao',
    example: '01310-930',
  })
  @ApiOkResponse({
    description: 'CEP encontrado e normalizado para um contrato unico',
    schema: {
      type: 'object',
      properties: {
        cep: { type: 'string', example: '01310930' },
        state: { type: 'string', example: 'SP' },
        city: { type: 'string', example: 'Sao Paulo' },
        neighborhood: { type: 'string', example: 'Bela Vista' },
        street: { type: 'string', example: 'Avenida Paulista' },
        provider: {
          type: 'string',
          enum: ['via-cep', 'brasil-api'],
          example: 'via-cep',
        },
      },
      required: ['cep', 'state', 'city', 'neighborhood', 'street', 'provider'],
    },
  })
  @ApiBadRequestResponse({
    description: 'CEP invalido ou falha de validacao do request',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Request validation failed' },
        details: {
          type: 'object',
          properties: {
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string', example: 'cep' },
                  message: {
                    type: 'string',
                    example: 'CEP must contain exactly 8 digits',
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'CEP nao encontrado em nenhum provider',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CEP_NOT_FOUND' },
        message: {
          type: 'string',
          example: 'CEP was not found in the configured providers',
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description:
      'Servico indisponivel: `CEP_PROVIDERS_UNAVAILABLE` quando ha falhas upstream mistas ou indisponibilidade; `CEP_PROVIDERS_RATE_LIMITED` quando todos os providers respondem com HTTP 429',
    schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: ['CEP_PROVIDERS_UNAVAILABLE', 'CEP_PROVIDERS_RATE_LIMITED'],
          example: 'CEP_PROVIDERS_UNAVAILABLE',
        },
        message: {
          type: 'string',
          example: 'All CEP providers are temporarily unavailable',
        },
      },
    },
  })
  @ApiGatewayTimeoutResponse({
    description: 'Todas as tentativas em providers terminaram em timeout',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'CEP_PROVIDERS_TIMEOUT' },
        message: {
          type: 'string',
          example: 'All CEP provider attempts timed out',
        },
      },
    },
  })
  @Get(':cep')
  async getCep(
    @Param(new ZodValidationPipe(cepParamSchema))
    params: CepParamDto,
  ): Promise<CepResponseDto> {
    return this.cepService.getCep(params.cep);
  }
}

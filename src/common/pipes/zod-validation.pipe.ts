import { Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

import { AppError } from '../errors/app-error';

@Injectable()
export class ZodValidationPipe<TOutput> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed', {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      throw error;
    }
  }
}

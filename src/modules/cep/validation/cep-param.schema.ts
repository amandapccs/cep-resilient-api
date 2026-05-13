import { z } from 'zod';

export const cepParamSchema = z.object({
  cep: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 8, {
      message: 'CEP must contain exactly 8 digits',
    }),
});

// Validation with the shared Zod schemas + OpenAPI generation from the same schemas.
import { type ArgumentMetadata, type PipeTransform, applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { Errors } from './errors';

export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown, _meta: ArgumentMetadata): z.output<T> {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) throw Errors.validation(z.flattenError(r.error));
    return r.data;
  }
}

type Json = Record<string, unknown>;
export const jsonSchema = (schema: z.ZodType, io: 'input' | 'output' = 'input'): Json =>
  z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'openapi-3.0' }) as Json;

export const ZodBody = (schema: z.ZodType) =>
  applyDecorators(ApiBody({ schema: jsonSchema(schema) }));

export const ZodResponse = (status: number, schema: z.ZodType, description = '') =>
  applyDecorators(ApiResponse({ status, description, schema: jsonSchema(schema, 'output') }));

/** Documents each top-level key of an object schema as a query parameter. */
export function ZodQuery(schema: z.ZodObject) {
  const decorators = Object.entries(schema.shape).map(([name, s]) =>
    ApiQuery({
      name,
      required: !(s as z.ZodType).safeParse(undefined).success,
      schema: jsonSchema(s as z.ZodType),
    }),
  );
  return applyDecorators(...decorators);
}

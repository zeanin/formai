import { z } from 'zod';
import type { AIMessage } from '@formai/shared';
import type { LLMManager } from './manager';

/**
 * Convert a Zod schema to a JSON Schema representation.
 * Handles: string, number, boolean, object, array, enum, optional, nullable, literal.
 */
export function zodToJsonSchema(schema: z.ZodSchema): Record<string, any> {
  return zodTypeToJsonSchema(schema);
}

function zodTypeToJsonSchema(schema: z.ZodTypeAny): Record<string, any> {
  // Unwrap ZodOptional
  if (schema instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(schema.unwrap());
  }
  // Unwrap ZodNullable
  if (schema instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(schema.unwrap());
    return { ...inner, nullable: true };
  }
  // ZodDefault
  if (schema instanceof z.ZodDefault) {
    return zodTypeToJsonSchema(schema._def.innerType);
  }
  // ZodString
  if (schema instanceof z.ZodString) {
    const result: Record<string, any> = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  // ZodNumber
  if (schema instanceof z.ZodNumber) {
    const result: Record<string, any> = { type: 'number' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  // ZodBoolean
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  // ZodLiteral
  if (schema instanceof z.ZodLiteral) {
    return { type: typeof schema.value, enum: [schema.value] };
  }
  // ZodEnum
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema.options as string[] };
  }
  // ZodNativeEnum
  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema.enum as Record<string, string | number>);
    return { enum: values };
  }
  // ZodArray
  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(schema.element),
    };
  }
  // ZodObject
  if (schema instanceof z.ZodObject) {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJsonSchema(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }
    const result: Record<string, any> = { type: 'object', properties };
    if (required.length > 0) result.required = required;
    if (schema.description) result.description = schema.description;
    return result;
  }
  // ZodRecord
  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: zodTypeToJsonSchema((schema as any)._def.valueType),
    };
  }
  // ZodUnion
  if (schema instanceof z.ZodUnion) {
    return { oneOf: (schema.options as z.ZodTypeAny[]).map(zodTypeToJsonSchema) };
  }
  // ZodIntersection
  if (schema instanceof z.ZodIntersection) {
    return {
      allOf: [zodTypeToJsonSchema(schema._def.left), zodTypeToJsonSchema(schema._def.right)],
    };
  }
  // ZodAny / ZodUnknown fallback
  return {};
}

/**
 * Generate structured output from an LLM using a Zod schema.
 * Retries on JSON parse or validation failure.
 */
export async function generateStructured<T>(
  llm: LLMManager,
  schema: z.ZodSchema<T>,
  prompt: string,
  options?: {
    maxRetries?: number;
    temperature?: number;
    systemPrompt?: string;
    provider?: string;
    model?: string;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const jsonSchema = zodToJsonSchema(schema);

  const systemContent = [
    options?.systemPrompt ?? 'You are a helpful assistant.',
    '',
    'You must respond with valid JSON that matches the following JSON Schema:',
    '```json',
    JSON.stringify(jsonSchema, null, 2),
    '```',
    '',
    'Respond ONLY with the JSON object. No markdown, no explanation, no extra text.',
  ].join('\n');

  let lastError: Error | null = null;
  let messages: AIMessage[] = [
    { role: 'system', content: systemContent },
    { role: 'user', content: prompt },
  ];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await llm.chat(messages, {
      temperature: options?.temperature ?? 0.2,
      responseFormat: 'json',
      provider: options?.provider,
      model: options?.model,
    });

    let raw = response.content.trim();
    // Strip markdown code fences if present
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    try {
      const parsed = JSON.parse(raw);
      const validated = schema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
      lastError = new Error(`Validation failed: ${JSON.stringify(validated.error.errors)}`);
      // Feed error back for retry
      messages = [
        ...messages,
        { role: 'assistant' as AIMessage['role'], content: response.content },
        {
          role: 'user' as AIMessage['role'],
          content: `Your response had validation errors:\n${JSON.stringify(validated.error.errors, null, 2)}\n\nPlease fix and respond with valid JSON only.`,
        },
      ];
    } catch (e) {
      lastError = e as Error;
      messages = [
        ...messages,
        { role: 'assistant' as AIMessage['role'], content: response.content },
        {
          role: 'user' as AIMessage['role'],
          content: `Your response was not valid JSON. Error: ${(e as Error).message}\n\nPlease respond with valid JSON only.`,
        },
      ];
    }
  }

  throw new Error(`Failed to generate valid structured output after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

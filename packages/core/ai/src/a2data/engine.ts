import { z } from 'zod';
import type { CollectionOptions, FieldOptions } from '@formai/shared';
import type { LLMManager } from '../llm/manager';
import {
  DATA_MODELING_SYSTEM_PROMPT,
  FIELD_SUGGESTION_SYSTEM_PROMPT,
  RELATION_SUGGESTION_SYSTEM_PROMPT,
  buildCollectionPrompt,
  buildFieldSuggestionPrompt,
  buildRelationSuggestionPrompt,
} from './prompts';

// ---- Zod schemas for structured output ----

const FieldOptionsSchema = z.object({
  name: z.string().describe('snake_case field name'),
  type: z.enum([
    'string', 'text', 'integer', 'float', 'double', 'decimal',
    'boolean', 'date', 'datetime', 'json', 'jsonb', 'uuid', 'array',
    'password', 'enum', 'virtual',
    'belongsTo', 'hasOne', 'hasMany', 'belongsToMany',
  ]),
  primaryKey: z.boolean().optional(),
  autoIncrement: z.boolean().optional(),
  allowNull: z.boolean().optional(),
  defaultValue: z.any().optional(),
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
  comment: z.string().optional(),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  values: z.array(z.string()).optional(),
  target: z.string().optional(),
  foreignKey: z.string().optional(),
  sourceKey: z.string().optional(),
  targetKey: z.string().optional(),
  through: z.string().optional(),
  onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional(),
  onUpdate: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']).optional(),
});

const CollectionOptionsSchema = z.object({
  name: z.string().describe('snake_case collection name'),
  title: z.string().optional().describe('Human-readable display name'),
  fields: z.array(FieldOptionsSchema),
  timestamps: z.boolean().optional(),
  paranoid: z.boolean().optional(),
  tableName: z.string().optional(),
  comment: z.string().optional(),
  sortable: z.boolean().optional(),
});

const FieldSuggestionsSchema = z.object({
  fields: z.array(FieldOptionsSchema),
});

const RelationSuggestionSchema = z.object({
  relations: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      type: z.enum(['belongsTo', 'hasOne', 'hasMany', 'belongsToMany']),
      field: FieldOptionsSchema,
    }),
  ),
});

// ---- Engine ----

export class A2DataEngine {
  constructor(private llm: LLMManager) {}

  /**
   * Generate a full collection definition from a natural language prompt.
   */
  async generateCollection(
    prompt: string,
    context?: { existingCollections?: string[] },
  ): Promise<CollectionOptions> {
    const userPrompt = buildCollectionPrompt(prompt, context?.existingCollections);

    const result = await this.llm.generate(CollectionOptionsSchema, userPrompt, {
      systemPrompt: DATA_MODELING_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return result as CollectionOptions;
  }

  /**
   * Suggest fields for a collection based on its name and optional description.
   */
  async suggestFields(collectionName: string, description?: string): Promise<FieldOptions[]> {
    const userPrompt = buildFieldSuggestionPrompt(collectionName, description);

    const result = await this.llm.generate(FieldSuggestionsSchema, userPrompt, {
      systemPrompt: FIELD_SUGGESTION_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return result.fields as FieldOptions[];
  }

  /**
   * Suggest relations between a list of collections.
   */
  async suggestRelations(
    collections: string[],
  ): Promise<Array<{ from: string; to: string; type: string; field: FieldOptions }>> {
    const userPrompt = buildRelationSuggestionPrompt(collections);

    const result = await this.llm.generate(RelationSuggestionSchema, userPrompt, {
      systemPrompt: RELATION_SUGGESTION_SYSTEM_PROMPT,
      temperature: 0.2,
    });

    return result.relations as Array<{ from: string; to: string; type: string; field: FieldOptions }>;
  }
}

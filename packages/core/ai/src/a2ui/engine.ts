import type { ISchema } from '@formai/shared';
import { z } from 'zod';
import type { LLMManager } from '../llm/manager';
import { zodToJsonSchema } from '../llm/structured-output';
import {
  UI_SYSTEM_PROMPT,
  UI_BLOCK_SYSTEM_PROMPT,
  UI_MODIFY_SYSTEM_PROMPT,
  UI_SUGGEST_SYSTEM_PROMPT,
  CODEX_COMPILER_SELF_HEALING_PROMPT,
  PageBlueprintZod,
  buildPageGenerationPrompt,
  buildBlockPrompt,
  buildModifySchemaPrompt,
  buildSuggestUIPrompt,
  buildSelfHealingPrompt,
} from './prompts';
import { validateSchema, fixSchema } from './schema-validator';
import { ALL_EXAMPLES } from './examples';

export interface GeneratePageOptions {
  prompt: string;
  collection?: string;
  fields?: string[];
  context?: {
    existingPages?: string[];
    collections?: string[];
    availableComponents?: Array<{ name: string; category: string; description: string }>;
    schemaUid?: string;
    pageSchema?: any;
    selectedBlockUid?: string | null;
    selectedBlockSchema?: any | null;
  };
  mode: 'create' | 'modify';
  codex?: any;
  llmProviderConfig?: any;
}

export interface GenerateBlockOptions {
  prompt: string;
  collection?: string;
  fields?: string[];
  blockType?: string;
  codex?: any;
  llmProviderConfig?: any;
}

// ---- Zod schemas for structured LLM output ----
const ISchemaZod: z.ZodType<ISchema> = z
  .object({
    type: z.enum(['void', 'object', 'array', 'string', 'number', 'boolean']).optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    'x-component': z.string().optional(),
    'x-component-props': z.record(z.any()).optional(),
    'x-decorator': z.string().optional(),
    'x-decorator-props': z.record(z.any()).optional(),
    'x-uid': z.string().optional(),
    'x-data': z.record(z.any()).optional(),
    'x-visible': z.boolean().optional(),
    'x-hidden': z.boolean().optional(),
    'x-disabled': z.boolean().optional(),
    'x-read-only': z.boolean().optional(),
    'x-editable': z.boolean().optional(),
    'x-async': z.boolean().optional(),
    'x-index': z.number().optional(),
    'x-pattern': z.enum(['editable', 'disabled', 'readPretty']).optional(),
    'x-display': z.enum(['visible', 'hidden', 'none']).optional(),
    'x-content': z.any().optional(),
    properties: z.record(z.any()).optional(),
    items: z.any().optional(),
    required: z.union([z.boolean(), z.array(z.string())]).optional(),
    default: z.any().optional(),
  })
  .passthrough();

const SuggestUIZod = z.object({
  suggestions: z.array(ISchemaZod),
});

export class A2UIEngine {
  constructor(private llm: LLMManager) {}

  private async executePrompt<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    systemPrompt: string,
    options?: { codex?: any; llmProviderConfig?: any }
  ): Promise<T> {
    const codex = options?.codex;
    const llmProviderConfig = options?.llmProviderConfig;
    if (codex && llmProviderConfig) {
      try {
        const thread = codex.startThread({
          workingDirectory: process.cwd(),
          skipGitRepoCheck: true,
          model: llmProviderConfig.model,
          llmProvider: llmProviderConfig,
        });
        const jsonSchema = zodToJsonSchema(schema);
        const systemContent = [
          systemPrompt || 'You are a helpful assistant.',
          '',
          'You must respond with valid JSON that matches the following JSON Schema:',
          '```json',
          JSON.stringify(jsonSchema, null, 2),
          '```',
          '',
          'Respond ONLY with the JSON object. No markdown, no explanation, no extra text.',
        ].join('\n');

        const fullPrompt = `System instructions:\n${systemContent}\n\nUser request:\n${prompt}`;
        const turn = await thread.run(fullPrompt, { outputSchema: jsonSchema });
        const clean = turn.finalResponse.trim();
        let raw = clean;
        if (raw.startsWith('```')) {
          raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
        }
        return JSON.parse(raw) as T;
      } catch (err: any) {
        console.warn(`[A2UIEngine] Codex generation failed: ${err.message}. Falling back to standard LLM.`);
      }
    }

    return this.llm.generate(schema, prompt, {
      systemPrompt,
      temperature: 0.2,
    });
  }

  /**
   * Codex Compiler Pattern: Self-Healing validation loop.
   * Feeds syntax and AST errors back into the LLM up to 3 times to guarantee a valid schema.
   */
  private async selfHealSchema(originalSchema: ISchema, errors: string[], options?: { codex?: any; llmProviderConfig?: any }): Promise<ISchema> {
    const rawJson = JSON.stringify(originalSchema, null, 2);
    const healingPrompt = buildSelfHealingPrompt(rawJson, errors);

    const raw = await this.executePrompt(ISchemaZod, healingPrompt, CODEX_COMPILER_SELF_HEALING_PROMPT, options);

    return fixSchema(raw);
  }

  /**
   * Hybrid Multi-Agent Generation Pipeline:
   * 1. A2Architect Role: Generate Page Blueprint.
   * 2. A2UI Generator Role: Generate components (Filter, Table, Forms) for the Blueprint.
   * 3. A2Integration Role: Stitch blocks together into a high-level Page schema.
   * 4. A2Validator Compiler (Self-Healing Loop): Verify and self-heal the final schema.
   */
  async generatePage(options: GeneratePageOptions): Promise<ISchema> {
    if (options.mode === 'modify') {
      // Direct instruction editing
      const ctx = options.context as any;
      const currentSchema = ctx?.selectedBlockSchema || ctx?.pageSchema || ALL_EXAMPLES[0].schema;
      const currentSchemaJson = JSON.stringify(currentSchema, null, 2);
      const userPrompt = buildModifySchemaPrompt({
        currentSchema: currentSchemaJson,
        instruction: options.prompt,
      });

      const raw = await this.executePrompt(ISchemaZod, userPrompt, UI_MODIFY_SYSTEM_PROMPT, options);

      return fixSchema(raw);
    }

    console.log('[A2UIEngine] Multi-Agent Pipeline: Stage 1 (A2Architect Blueprint Generation)');
    const collection = options.collection || 'generic_records';
    const fields = options.fields || ['name', 'status'];

    const architectPrompt = `Generate a page blueprint for a business application view based on the user request.
User Prompt: "${options.prompt}"
Target Collection: "${collection}"
Available Fields: ${fields.join(', ')}`;

    // A2Architect generates high-level PageBlueprint
    const blueprintRaw = await this.executePrompt(z.any(), architectPrompt, 'You are the A2Architect page structure designer. Create a logical enterprise application view blueprint, OR if you are returning a legacy/direct Formily Page schema directly, ensure it has Page as the x-component.', options);

    // Check if the returned object is already a full page schema rather than a blueprint
    if (blueprintRaw && (blueprintRaw['x-component'] === 'Page' || (!blueprintRaw.blocks && blueprintRaw.properties))) {
      console.log('[A2UIEngine] Direct full page schema detected in blueprint. Bypassing stitching pipeline.');
      let finalSchema = fixSchema(blueprintRaw);
      
      // Perform validation and self-healing loop
      const { valid, errors } = validateSchema(finalSchema);
      if (!valid) {
        finalSchema = await this.selfHealSchema(finalSchema, errors, options);
      }
      return finalSchema;
    }

    const blueprint = blueprintRaw as z.infer<typeof PageBlueprintZod>;

    console.log('[A2UIEngine] Multi-Agent Pipeline: Stage 2 & 3 (A2UI Component Generation & A2Integration)');

    // Build subcomponents based on the blueprint blocks
    const pageProperties: Record<string, ISchema> = {};

    // 1. Generate Filter Block
    const filterBlock = blueprint.blocks.find((b) => b.type === 'FilterBlock');
    if (filterBlock) {
      pageProperties[filterBlock.id] = {
        type: 'void',
        'x-component': 'FilterBlock',
        'x-index': 10,
        'x-component-props': {
          collection: blueprint.collection,
          fields: filterBlock.fields.map((f) => ({
            name: f,
            title: f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' '),
            type: f === 'status' ? 'enum' : f.includes('date') || f.includes('time') ? 'date' : 'string',
            values: f === 'status' ? ['active', 'inactive', 'draft', 'completed'] : undefined,
          })),
        },
      };
    }

    // 2. Generate Add Drawer Form and Action Space
    const tableBlock = blueprint.blocks.find((b) => b.type === 'TableBlock');
    const tableActions = tableBlock?.actions || [];
    const actionSpaceProperties: Record<string, ISchema> = {};

    const hasAddAction = tableActions.some((a) => a.name === 'add');
    if (hasAddAction) {
      // A2UI Generator creates Add Form Block schema
      console.log('[A2UIEngine] Generating Edit/Add Form Block...');
      const formBlockSchema = await this.generateBlock({
        prompt: `Generate a fully functional business form for collection "${blueprint.collection}" with inputs for: ${fields.join(', ')}. Do not include ID or system audit fields as inputs.`,
        collection: blueprint.collection,
        fields,
        blockType: 'Form',
        codex: options.codex,
        llmProviderConfig: options.llmProviderConfig,
      });

      actionSpaceProperties['addDrawer'] = {
        type: 'void',
        title: 'Add New',
        'x-component': 'ActionDrawer',
        'x-component-props': {
          width: 600,
        },
        properties: {
          addForm: formBlockSchema,
        },
      };
    }

    // 3. Generate CSV Import and Export Actions
    const hasImportAction = tableActions.some((a) => a.name === 'import');
    if (hasImportAction) {
      actionSpaceProperties['importAction'] = {
        type: 'void',
        title: 'Import',
        'x-component': 'Action',
        'x-component-props': {
          action: 'import',
          collection: blueprint.collection,
        },
      };
    }

    const hasExportAction = tableActions.some((a) => a.name === 'export');
    if (hasExportAction) {
      actionSpaceProperties['exportAction'] = {
        type: 'void',
        title: 'Export',
        'x-component': 'Action',
        'x-component-props': {
          action: 'export',
          collection: blueprint.collection,
        },
      };
    }

    const hasDeleteAction = tableActions.some((a) => a.name === 'destroy');
    if (hasDeleteAction) {
      actionSpaceProperties['batchDeleteAction'] = {
        type: 'void',
        title: 'Delete Selected',
        'x-component': 'Action',
        'x-component-props': {
          action: 'destroy',
          danger: true,
          collection: blueprint.collection,
          confirmTitle: 'Are you sure you want to delete selected records?',
        },
      };
    }

    // Assemble Action Space (Toolbar)
    if (Object.keys(actionSpaceProperties).length > 0) {
      pageProperties['actionBar'] = {
        type: 'void',
        'x-component': 'Space',
        'x-index': 20,
        'x-component-props': {
          style: { marginBottom: 16 },
        },
        properties: actionSpaceProperties,
      };
    }

    // 4. Generate Main Data Table
    if (tableBlock) {
      console.log('[A2UIEngine] Generating Main Data Table Block...');
      const tableColumns = tableBlock.fields.map((f) => ({
        title: f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' '),
        dataIndex: f,
        key: f,
        sorter: true,
        render: f === 'status' ? 'status' : f === 'amount' || f === 'price' ? 'amount' : undefined,
      }));

      pageProperties[tableBlock.id] = {
        type: 'array',
        'x-component': 'Table',
        'x-index': 30,
        'x-component-props': {
          collection: blueprint.collection,
          columns: tableColumns,
          rowSelection: true,
          pagination: {
            pageSize: 10,
            showSizeChanger: true,
          },
        },
      };
    }

    // Stitch into full Page root Schema
    const assembledSchema: ISchema = {
      type: 'void',
      'x-component': 'Page',
      'x-component-props': {
        title: blueprint.title,
      },
      properties: {
        layoutGrid: {
          type: 'void',
          'x-component': 'Grid',
          'x-component-props': {
            cols: 1,
          },
          properties: pageProperties,
        },
      },
    };

    // Stage 4: A2Validator Compiler Self-Healing Loop
    console.log('[A2UIEngine] Multi-Agent Pipeline: Stage 4 (A2Validator Codex Compiler Validation)');
    let finalSchema = fixSchema(assembledSchema);
    const maxHealingRetries = 3;

    for (let retry = 1; retry <= maxHealingRetries; retry++) {
      const { valid, errors } = validateSchema(finalSchema);
      if (valid) {
        console.log('[A2UIEngine] Validation succeeded! Schema is fully valid.');
        break;
      }

      console.warn(`[A2UIEngine] Validation failed on attempt ${retry}/${maxHealingRetries}. Errors:`, errors);
      if (retry === maxHealingRetries) {
        console.error('[A2UIEngine] Self-healing max retries exceeded. Falling back to fixSchema auto-remediation.');
        finalSchema = fixSchema(finalSchema);
        break;
      }

      console.log(`[A2UIEngine] Triggering self-healing compiler to auto-correct schema errors...`);
      finalSchema = await this.selfHealSchema(finalSchema, errors, options);
    }

    return finalSchema;
  }

  /**
   * Generate a single block schema (Table, Form, etc.) from a prompt.
   */
  async generateBlock(options: GenerateBlockOptions): Promise<ISchema> {
    const userPrompt = buildBlockPrompt(options);

    const raw = await this.executePrompt(ISchemaZod, userPrompt, UI_BLOCK_SYSTEM_PROMPT, options);

    const { valid, errors } = validateSchema(raw);
    if (!valid) {
      const fixed = fixSchema(raw);
      const recheck = validateSchema(fixed);
      if (!recheck.valid) {
        throw new Error(`Generated block schema is invalid after auto-fix: ${recheck.errors.join('; ')}`);
      }
      return fixed;
    }

    return fixSchema(raw);
  }

  /**
   * Modify an existing schema based on a natural language instruction.
   * Key: preserve x-uid values for unchanged nodes.
   */
  async modifySchema(currentSchema: ISchema, instruction: string, options?: { codex?: any; llmProviderConfig?: any }): Promise<ISchema> {
    const currentSchemaJson = JSON.stringify(currentSchema, null, 2);
    const userPrompt = buildModifySchemaPrompt({
      currentSchema: currentSchemaJson,
      instruction,
    });

    const raw = await this.executePrompt(ISchemaZod, userPrompt, UI_MODIFY_SYSTEM_PROMPT, options);

    const merged = this.mergeUids(currentSchema, raw);

    const { valid, errors } = validateSchema(merged);
    if (!valid) {
      const fixed = fixSchema(merged);
      const recheck = validateSchema(fixed);
      if (!recheck.valid) {
        throw new Error(`Modified schema is invalid after auto-fix: ${recheck.errors.join('; ')}`);
      }
      return fixed;
    }

    return fixSchema(merged);
  }

  /**
   * Suggest multiple UI layouts based on collection name and fields.
   * Returns 2-3 suggested ISchema layouts (table, form, detail).
   */
  async suggestUI(
    collectionName: string,
    fields: Array<{ name: string; type: string }>,
    options?: { codex?: any; llmProviderConfig?: any }
  ): Promise<ISchema[]> {
    const userPrompt = buildSuggestUIPrompt({ collectionName, fields });

    const result = await this.executePrompt(SuggestUIZod, userPrompt, UI_SUGGEST_SYSTEM_PROMPT, options);

    return result.suggestions.map((s) => fixSchema(s));
  }

  private buildSystemPrompt(context?: GeneratePageOptions['context']): string {
    const parts: string[] = [UI_SYSTEM_PROMPT];

    if (context?.availableComponents && context.availableComponents.length > 0) {
      parts.push('\n## Available Components');
      for (const comp of context.availableComponents) {
        parts.push(`- ${comp.name} (${comp.category}): ${comp.description}`);
      }
    }

    const example = ALL_EXAMPLES[0];
    parts.push('\n## Example Schema');
    parts.push(`Name: ${example.name}`);
    parts.push('```json');
    parts.push(JSON.stringify(example.schema, null, 2));
    parts.push('```');

    return parts.join('\n');
  }

  private mergeUids(original: ISchema, modified: ISchema): ISchema {
    const result = JSON.parse(JSON.stringify(modified)) as ISchema;

    function merge(orig: ISchema, mod: ISchema): void {
      if (orig['x-uid'] && !mod['x-uid']) {
        mod['x-uid'] = orig['x-uid'];
      }
      if (orig['x-uid'] && mod['x-uid'] && orig['x-component'] === mod['x-component']) {
        mod['x-uid'] = orig['x-uid'];
      }

      if (orig.properties && mod.properties) {
        for (const key of Object.keys(mod.properties)) {
          if (orig.properties[key]) {
            merge(orig.properties[key], mod.properties[key]);
          }
        }
      }
    }

    merge(original, result);
    return result;
  }
}

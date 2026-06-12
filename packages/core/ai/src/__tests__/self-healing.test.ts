import { describe, it, expect, beforeEach } from 'vitest';
import { A2UIEngine } from '../a2ui/engine';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';
import { validateSchema } from '../a2ui/schema-validator';
import type { ISchema } from '@formai/shared';

describe('Codex Self-Healing & Blueprint Compilation', () => {
  let manager: LLMManager;
  let mock: MockLLMProvider;
  let engine: A2UIEngine;

  beforeEach(() => {
    manager = new LLMManager();
    mock = new MockLLMProvider();
    manager.registerProvider(mock);
    engine = new A2UIEngine(manager);
  });

  it('runs the multi-agent blueprint-driven page generation pipeline', async () => {
    // 1. First response: A2Architect PageBlueprint
    const mockBlueprint = {
      title: 'Contract Directory',
      collection: 'contracts',
      description: 'Manage company contracts',
      blocks: [
        {
          id: 'contractsFilter',
          type: 'FilterBlock',
          title: 'Search Contracts',
          fields: ['name', 'status'],
        },
        {
          id: 'contractsTable',
          type: 'TableBlock',
          title: 'Contracts Grid',
          fields: ['name', 'status', 'amount'],
          actions: [
            { name: 'add', title: 'Create Contract', type: 'openDrawer' },
            { name: 'import', title: 'Import Contracts', type: 'import' },
            { name: 'export', title: 'Export Contracts', type: 'export' },
            { name: 'destroy', title: 'Delete Selected', type: 'destroy' },
          ],
        },
      ],
    };

    // 2. Second response: A2UI Generator Form Block
    const mockFormBlock = {
      type: 'object',
      'x-component': 'Form',
      properties: {
        name: {
          type: 'string',
          'x-component': 'Input',
          'x-decorator': 'FormItem',
          title: 'Contract Name',
        },
        status: {
          type: 'string',
          'x-component': 'Select',
          'x-decorator': 'FormItem',
          title: 'Status',
        },
      },
    };

    mock.setResponses([
      { role: 'assistant', content: JSON.stringify(mockBlueprint) },
      { role: 'assistant', content: JSON.stringify(mockFormBlock) },
    ]);

    const result = await engine.generatePage({
      prompt: 'Build a standard premium contract directory with search, batch delete, csv import and export.',
      collection: 'contracts',
      fields: ['name', 'status', 'amount'],
      mode: 'create',
    });

    // Verify A2Integration stitched properties correctly
    expect(result.type).toBe('void');
    expect(result['x-component']).toBe('Page');
    expect(result['x-component-props']?.title).toBe('Contract Directory');

    const layoutGrid = result.properties?.layoutGrid;
    expect(layoutGrid).toBeDefined();
    expect(layoutGrid['x-component']).toBe('Grid');

    const pageProperties = layoutGrid.properties;
    expect(pageProperties).toBeDefined();

    // Verify FilterBlock is placed at top
    expect(pageProperties.contractsFilter).toBeDefined();
    expect(pageProperties.contractsFilter['x-component']).toBe('FilterBlock');
    expect(pageProperties.contractsFilter['x-component-props']?.collection).toBe('contracts');

    // Verify ActionBar Space is placed in middle
    expect(pageProperties.actionBar_contractsTable).toBeDefined();
    expect(pageProperties.actionBar_contractsTable['x-component']).toBe('Space');
    const actions = pageProperties.actionBar_contractsTable.properties;
    expect(actions.importAction).toBeDefined();
    expect(actions.importAction['x-component-props']?.action).toBe('import');
    expect(actions.exportAction).toBeDefined();
    expect(actions.exportAction['x-component-props']?.action).toBe('export');

    // Verify Table is placed at bottom
    expect(pageProperties.contractsTable).toBeDefined();
    expect(pageProperties.contractsTable['x-component']).toBe('Table');
    expect(pageProperties.contractsTable['x-component-props']?.collection).toBe('contracts');
    expect(pageProperties.contractsTable['x-component-props']?.rowSelection).toBe(true);
  });

  it('triggers Codex self-healing compiler loop when schema has validation errors', async () => {
    // Stage 1 Blueprint
    const mockBlueprint = {
      title: 'Simple View',
      collection: 'items',
      description: 'Simple Items view',
      blocks: [
        {
          id: 'itemsTable',
          type: 'TableBlock',
          title: 'Items Table',
          fields: ['name'],
          actions: [],
        },
      ],
    };

    // Stage 2 Self-healing correction response (will be asked to correct layoutGrid property type)
    const correctedSchema: ISchema = {
      type: 'void',
      'x-component': 'Page',
      'x-component-props': { title: 'Simple View' },
      properties: {
        layoutGrid: {
          type: 'void',
          'x-component': 'Grid',
          'x-component-props': { cols: 1 },
          properties: {
            itemsTable: {
              type: 'array',
              'x-component': 'Table',
              'x-component-props': { collection: 'items', columns: [] },
            },
          },
        },
      },
    };

    // Set responses:
    // We only need one response for direct selfHealSchema test call
    mock.setResponses([
      { role: 'assistant', content: JSON.stringify(correctedSchema) },
    ]);

    // Force engine.selfHealSchema directly to test the self healing loop isolation
    const invalidSchema: ISchema = {
      type: 'invalid' as any, // Invalid type! Should fail validateSchema
      'x-component': 'Page',
    };

    const healed = await (engine as any).selfHealSchema(invalidSchema, ['Invalid type "invalid" at root']);
    const validation = validateSchema(healed);

    expect(validation.valid).toBe(true);
    expect(healed['x-component']).toBe('Page');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { A2UIEngine } from '../a2ui/engine';
import type { GeneratePageOptions } from '../a2ui/engine';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';
import { validateSchema, fixSchema } from '../a2ui/schema-validator';
import { ALL_EXAMPLES, CRUD_TABLE_EXAMPLE, FORM_EXAMPLE } from '../a2ui/examples';
import type { ISchema } from '@formai/shared';

// ---- Helpers ----

/** A valid CRUD page schema the mock LLM can return */
const MOCK_PAGE_SCHEMA: ISchema = {
  type: 'void',
  'x-uid': 'page1',
  'x-component': 'Page',
  'x-component-props': { title: 'Users Management' },
  properties: {
    actionBar: {
      type: 'void',
      'x-uid': 'ab1',
      'x-component': 'Space',
      properties: {
        create: {
          type: 'void',
          'x-uid': 'ac1',
          'x-component': 'Action',
          'x-component-props': { title: 'Add New', type: 'primary' },
        },
      },
    },
    table: {
      type: 'array',
      'x-uid': 'tbl1',
      'x-component': 'Table',
      'x-decorator': 'CardItem',
      'x-component-props': {
        columns: [
          { title: 'Username', dataIndex: 'username', key: 'username' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
        ],
        pagination: { pageSize: 20 },
      },
    },
  },
};

const MOCK_TABLE_BLOCK: ISchema = {
  type: 'array',
  'x-uid': 'blkTbl1',
  'x-component': 'Table',
  'x-decorator': 'CardItem',
  'x-component-props': {
    columns: [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      { title: 'Value', dataIndex: 'value', key: 'value' },
    ],
    pagination: { pageSize: 10 },
  },
};

const MOCK_FORM_BLOCK: ISchema = {
  type: 'object',
  'x-uid': 'blkForm1',
  'x-component': 'Form',
  properties: {
    name: {
      type: 'string',
      'x-uid': 'fName1',
      title: 'Name',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
    },
    submit: {
      type: 'void',
      'x-uid': 'fSubmit1',
      'x-component': 'Action',
      'x-component-props': { title: 'Submit', type: 'primary' },
    },
  },
};

const MOCK_SUGGESTIONS = {
  suggestions: [
    {
      type: 'array',
      'x-uid': 'sugTbl1',
      'x-component': 'Table',
      'x-component-props': {
        columns: [
          { title: 'Name', dataIndex: 'name', key: 'name' },
        ],
      },
    },
    {
      type: 'object',
      'x-uid': 'sugForm1',
      'x-component': 'Form',
      properties: {
        name: {
          type: 'string',
          'x-uid': 'sfName',
          title: 'Name',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
        },
      },
    },
    {
      type: 'void',
      'x-uid': 'sugDetail1',
      'x-component': 'Descriptions',
      properties: {
        name: {
          type: 'string',
          'x-uid': 'sdName',
          title: 'Name',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-read-only': true,
        },
      },
    },
  ],
};

describe('A2UIEngine', () => {
  let manager: LLMManager;
  let mock: MockLLMProvider;
  let engine: A2UIEngine;

  beforeEach(() => {
    manager = new LLMManager();
    mock = new MockLLMProvider();
    manager.registerProvider(mock);
    engine = new A2UIEngine(manager);
  });

  // ---- generatePage ----

  describe('generatePage', () => {
    it('generates a valid ISchema page from a prompt', async () => {
      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(MOCK_PAGE_SCHEMA) },
      ]);

      const result = await engine.generatePage({
        prompt: 'A user management page',
        collection: 'users',
        mode: 'create',
      });

      expect(result.type).toBe('void');
      expect(result['x-component']).toBe('Page');
      expect(result.properties).toBeDefined();
    });

    it('passes collection and context in the prompt', async () => {
      let capturedMessages: any[] = [];
      mock.chat = async (messages: any[]) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify(MOCK_PAGE_SCHEMA) };
      };

      await engine.generatePage({
        prompt: 'A product list page',
        collection: 'products',
        fields: ['name', 'price'],
        context: {
          existingPages: ['Home'],
          collections: ['users', 'products'],
        },
        mode: 'create',
      });

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('products');
      expect(userMessage?.content).toContain('name');
    });

    it('auto-fixes schemas missing type or x-uid', async () => {
      const rawSchema = {
        'x-component': 'Page',
        properties: {
          child: {
            'x-component': 'Table',
          },
        },
      };

      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(rawSchema) },
      ]);

      const result = await engine.generatePage({
        prompt: 'A simple page',
        mode: 'create',
      });

      // fixSchema should have added type='void' and x-uid
      expect(result.type).toBe('void');
      expect(result['x-uid']).toBeDefined();
      if (result.properties?.child) {
        expect(result.properties.child.type).toBe('void');
        expect(result.properties.child['x-uid']).toBeDefined();
      }
    });
  });

  // ---- generateBlock ----

  describe('generateBlock', () => {
    it('generates a table block schema', async () => {
      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(MOCK_TABLE_BLOCK) },
      ]);

      const result = await engine.generateBlock({
        prompt: 'A table showing product data',
        collection: 'products',
        blockType: 'Table',
      });

      expect(result['x-component']).toBe('Table');
      expect(result.type).toBe('array');
    });

    it('generates a form block schema', async () => {
      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(MOCK_FORM_BLOCK) },
      ]);

      const result = await engine.generateBlock({
        prompt: 'A form for creating users',
        collection: 'users',
        blockType: 'Form',
      });

      expect(result['x-component']).toBe('Form');
      expect(result.properties).toBeDefined();
    });

    it('auto-fixes block schema issues', async () => {
      const rawBlock = {
        'x-component': 'Table',
        'x-component-props': {
          columns: [{ title: 'Name', dataIndex: 'name', key: 'name' }],
        },
      };

      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(rawBlock) },
      ]);

      const result = await engine.generateBlock({
        prompt: 'A table block',
        blockType: 'Table',
      });

      expect(result.type).toBe('void');
      expect(result['x-uid']).toBeDefined();
    });
  });

  // ---- modifySchema ----

  describe('modifySchema', () => {
    it('modifies a schema and preserves existing x-uid values', async () => {
      const currentSchema: ISchema = {
        type: 'void',
        'x-uid': 'origPage1',
        'x-component': 'Page',
        properties: {
          table: {
            type: 'array',
            'x-uid': 'origTbl1',
            'x-component': 'Table',
            'x-component-props': {
              columns: [{ title: 'Name', dataIndex: 'name', key: 'name' }],
            },
          },
        },
      };

      const modifiedSchema: ISchema = {
        type: 'void',
        'x-uid': 'modPage1',
        'x-component': 'Page',
        properties: {
          table: {
            type: 'array',
            'x-uid': 'modTbl1',
            'x-component': 'Table',
            'x-component-props': {
              columns: [
                { title: 'Name', dataIndex: 'name', key: 'name' },
                { title: 'Email', dataIndex: 'email', key: 'email' },
              ],
            },
          },
          form: {
            type: 'object',
            'x-uid': 'modForm1',
            'x-component': 'Form',
          },
        },
      };

      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(modifiedSchema) },
      ]);

      const result = await engine.modifySchema(currentSchema, 'Add an email column and a form block');

      // The 'table' node should preserve the original x-uid because
      // same component at same path
      expect(result.properties?.table?.['x-uid']).toBe('origTbl1');
    });

    it('sends current schema JSON in the prompt', async () => {
      let capturedMessages: any[] = [];
      mock.chat = async (messages: any[]) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify(MOCK_PAGE_SCHEMA) };
      };

      const schema: ISchema = {
        type: 'void',
        'x-uid': 'test1',
        'x-component': 'Page',
      };

      await engine.modifySchema(schema, 'Add a table');

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('test1');
      expect(userMessage?.content).toContain('Add a table');
    });
  });

  // ---- suggestUI ----

  describe('suggestUI', () => {
    it('returns multiple suggested layouts', async () => {
      mock.setResponses([
        { role: 'assistant', content: JSON.stringify(MOCK_SUGGESTIONS) },
      ]);

      const results = await engine.suggestUI('products', [
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
      ]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Each should have x-uid (auto-fixed)
      for (const schema of results) {
        expect(schema['x-uid']).toBeDefined();
      }
    });

    it('passes collection and fields in the prompt', async () => {
      let capturedMessages: any[] = [];
      mock.chat = async (messages: any[]) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify(MOCK_SUGGESTIONS) };
      };

      await engine.suggestUI('orders', [
        { name: 'id', type: 'integer' },
        { name: 'total', type: 'float' },
      ]);

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('orders');
      expect(userMessage?.content).toContain('id');
      expect(userMessage?.content).toContain('total');
    });
  });
});

// ---- schema-validator tests ----

describe('validateSchema', () => {
  it('returns valid for a correct schema', () => {
    const result = validateSchema(MOCK_PAGE_SCHEMA);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('catches invalid type', () => {
    const schema: ISchema = { type: 'invalid' as any };
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid type');
  });

  it('warns on unknown components when knownComponents provided', () => {
    const schema: ISchema = {
      type: 'void',
      'x-component': 'UnknownWidget',
    };
    const result = validateSchema(schema, ['Page', 'Table', 'Form']);
    expect(result.valid).toBe(true); // warnings don't invalidate
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('UnknownWidget');
  });

  it('does not warn on known components', () => {
    const schema: ISchema = {
      type: 'void',
      'x-component': 'Table',
    };
    const result = validateSchema(schema, ['Page', 'Table', 'Form']);
    expect(result.warnings).toHaveLength(0);
  });

  it('validates recursively into properties', () => {
    const schema: ISchema = {
      type: 'void',
      'x-component': 'Page',
      properties: {
        child: {
          type: 'badtype' as any,
        },
      },
    };
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('root.child');
  });
});

describe('fixSchema', () => {
  it('adds missing type as void', () => {
    const schema: ISchema = { 'x-component': 'Page' };
    const fixed = fixSchema(schema);
    expect(fixed.type).toBe('void');
  });

  it('adds missing x-uid', () => {
    const schema: ISchema = { type: 'void', 'x-component': 'Page' };
    const fixed = fixSchema(schema);
    expect(fixed['x-uid']).toBeDefined();
    expect(typeof fixed['x-uid']).toBe('string');
    expect(fixed['x-uid']!.length).toBeGreaterThan(0);
  });

  it('replaces unknown components with Div fallback', () => {
    const schema: ISchema = {
      type: 'void',
      'x-component': 'UnknownWidget',
    };
    const fixed = fixSchema(schema, ['Page', 'Table', 'Form']);
    expect(fixed['x-component']).toBe('Div');
  });

  it('keeps known components unchanged', () => {
    const schema: ISchema = {
      type: 'void',
      'x-component': 'Table',
    };
    const fixed = fixSchema(schema, ['Page', 'Table', 'Form']);
    expect(fixed['x-component']).toBe('Table');
  });

  it('fixes recursively into properties', () => {
    const schema: ISchema = {
      'x-component': 'Page',
      properties: {
        child: {
          'x-component': 'Table',
        },
      },
    };
    const fixed = fixSchema(schema);
    expect(fixed.type).toBe('void');
    expect(fixed['x-uid']).toBeDefined();
    expect(fixed.properties?.child.type).toBe('void');
    expect(fixed.properties?.child['x-uid']).toBeDefined();
  });

  it('does not mutate the original schema', () => {
    const original: ISchema = { 'x-component': 'Page' };
    const copy = JSON.parse(JSON.stringify(original));
    fixSchema(original);
    expect(original).toEqual(copy);
  });
});

// ---- examples tests ----

describe('ALL_EXAMPLES', () => {
  it('contains at least 4 example schemas', () => {
    expect(ALL_EXAMPLES.length).toBeGreaterThanOrEqual(4);
  });

  it('each example is a valid ISchema', () => {
    for (const ex of ALL_EXAMPLES) {
      const result = validateSchema(ex.schema);
      expect(result.valid, `Example "${ex.name}" should be valid: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('CRUD_TABLE_EXAMPLE has Table component', () => {
    expect(CRUD_TABLE_EXAMPLE['x-component']).toBe('Page');
    const tableNode = CRUD_TABLE_EXAMPLE.properties?.table;
    expect(tableNode?.['x-component']).toBe('Table');
  });

  it('FORM_EXAMPLE has Form component', () => {
    const formNode = FORM_EXAMPLE.properties?.form;
    expect(formNode?.['x-component']).toBe('Form');
  });
});

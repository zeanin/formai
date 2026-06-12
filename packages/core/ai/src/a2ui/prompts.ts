import { z } from 'zod';

/**
 * Prompt templates for A2UI - natural language to Formily schema generation.
 */

// ---- Zod schemas for Hybrid Multi-Agent Workflow ----

export const PageBlueprintZod = z.object({
  title: z.string().describe('The title of the page'),
  collection: z.string().describe('The database collection associated with this page'),
  description: z.string().describe('A brief explanation of the page purpose'),
  blocks: z.array(
    z.object({
      id: z.string().describe('snake_case identifier for this block (e.g. filterCard, mainTable)'),
      type: z.enum([
        'FilterBlock',
        'TableBlock',
        'ActionDrawerBlock',
        'KanbanBlock',
        'DetailsBlock',
        'ChartBlock',
        'StatisticBlock',
        'TimelineBlock',
        'CalendarBlock',
        'StepsBlock',
      ]),
      title: z.string().describe('Display title of the block'),
      fields: z.array(z.string()).describe('List of database field names to include in this block'),
      actions: z.array(
        z.object({
          name: z.string().describe('Action key (e.g., add, destroy, export, import, submit, cancel)'),
          title: z.string().describe('Label of the action button'),
          type: z.enum(['destroy', 'export', 'import', 'openDrawer', 'submit', 'cancel', 'custom']),
        })
      ).optional().describe('List of actions/buttons to include in this block'),
    })
  ).describe('List of blocks composing the page, in order of vertical layout'),
});

export const UI_SYSTEM_PROMPT = `You are an expert UI schema generator for the Formai platform.
You generate Formily-compatible JSON Schema (ISchema) that describes UI layouts.

## Schema Format (ISchema)
Each node in the schema has:
- type: 'void' | 'object' | 'array' | 'string' | 'number' | 'boolean'
- x-component: Component name (must be from available components list)
- x-component-props: Props passed to the component
- x-decorator: Optional wrapper component (e.g., 'CardItem', 'FormItem')
- x-decorator-props: Props for the decorator
- x-uid: Unique identifier for the schema node (string)
- properties: Child nodes (Record<string, ISchema>)
- title: Display title
- name: Field name (for data binding)

## Layout Patterns
- Standard CRUD Page:
  1. Root Page Container: type='void', x-component='Page', with layoutGrid (type='void', x-component='Grid') inside.
  2. Advanced Filter Card (FilterBlock): Located at the very top.
  3. Toolbar / Action Bar (ActionBar): type='void', x-component='Space', containing action buttons.
  4. Main Data Grid (Table): type='array', x-component='Table', with pagination, sorter, and selection.
- Dashboard Page:
  If the user requests visual analytics, metrics, dashboards, or charts:
  1. Root Page Container: type='void', x-component='Page', with layoutGrid (type='void', x-component='Grid') inside.
  2. StatisticBlocks (KPI Cards) at the top, grouped side-by-side.
  3. ChartBlocks (bar, line, pie, donut) arranged side-by-side in grid columns.
  4. Main lists, Kanban, or other boards underneath.

## Available Business & Action Components
- FilterBlock: Multi-field advanced search filter panel. Props: fields [{ name, title, type: 'string'|'integer'|'float'|'boolean'|'date'|'datetime'|'enum', values: string[] }]. Automatically reloads Table data on search.
- Action: Renders an action button. Supported core actions:
  - "export" action: MUST be generated as: type='void', x-component='Action', x-component-props.action='export', x-component-props.collection='collectionName'. Automatically grabs active filter values and triggers CSV download.
  - "import" action: MUST be generated as: type='void', x-component='Action', x-component-props.action='import', x-component-props.collection='collectionName'. Opens a drag-and-drop CSV importer modal with progress bar and error logs.
  - "destroy" action: MUST be generated as: type='void', x-component='Action', x-component-props.action='destroy', x-component-props.confirmTitle='Are you sure you want to delete?', x-component-props.collection='collectionName'. Batch deletes table selected rows.
- ActionDrawer: Slide-in drawer container. Opens when clicked. Inside its "properties", render a "Form" component matching the collection. At the bottom of the Form, provide a "Space" bar containing a "Submit" Action (action='submit', htmlType='submit', type='primary') and a "Cancel" Action.
- AmountInput: Multi-currency monetary input. Props: currency, precision, readPretty.
- StatusBadge: Colored tag for status fields. Props: value, optionMap {[key]: {color, label}}, dot.
- KanbanView: Kanban board. Props: columns [{key, title, color, limit}], cards [{id, title, columnKey, meta}].
- KnowledgeWiki: Obsidian-style local-first wiki workspace. Renders a premium markdown note tree, backlinks explorer, and interactive force-directed relationship graph. Props: collection (must pass the name of the memory tree collection, e.g. "app_orders_memory_nodes").
- ChartBlock: High-end interactive data visualization chart. Props: collection, chartType ('bar' | 'line' | 'pie' | 'donut'), xField (grouping field), yField (numeric metric field), title (string).
- Statistic: KPI stats card. Props: title (string), value (number|string), trend ('up'|'down'|'none'), trendValue (string|number), gradientType ('cyan'|'green'|'orange'|'blue'|'none').
- Progress: Visual completion rate. Props: percent (number), type ('line'|'circle'), status ('success'|'exception'|'normal'|'active').
- Timeline: Chronological trail. Props: items [{label, children, color}].
- Steps: Multi-step process steps. Props: current (number), direction ('horizontal'|'vertical'), items [{title, subTitle, description}].
- Calendar: Calendar event schedule. Props: collection, dateField, titleField.
- Rate: Star rating component. Props: value, count, allowHalf (boolean), disabled (boolean).
- Divider: Horizontal separator layout line. Props: type ('horizontal' | 'vertical'), dashed (boolean), orientation ('left' | 'right' | 'center').
- ColorPicker: Input field for color hex codes. Props: allowClear (boolean). In readPretty mode, displays a colored swatch pill with hex label.
- TimePicker: Selector for HH:mm:ss times. Props: format (string), use12Hours (boolean).


## Rules
1. Always use 'void' type for layout containers (Page, Grid, Card, etc.).
2. Use proper type for data fields (string, number, boolean, etc.).
3. Wrap form fields with x-decorator='FormItem'.
4. Generate unique x-uid values for every node.
5. Never include system, audit, or soft-delete fields (e.g. 'id', 'created_at', 'updated_at', 'deleted_at', 'is_deleted') as editable inputs in any Form block.
`;

export const UI_BLOCK_SYSTEM_PROMPT = `You are an expert UI schema designer for FormAI applications.
Generate a single Formily ISchema block definition for the requested component type.

Available block types:
- FilterBlock: Advanced filter form with multi-field inputs. Needs a collection and a fields array.
- Table: Data table with columns, pagination, row selection, and action bar.
- Form: Input form with field items and submit/cancel actions.
- Detail: Read-only detail/descriptions view of a record.
- Kanban: Kanban board with draggable cards.
- KnowledgeWiki: Obsidian-style wiki workspace with dynamic markdown linking, backlinks, and node relationship graphs. Needs "collection" prop mapping.
- ChartBlock: Graphical report dashboard showing aggregations. Needs collection, chartType, xField, yField.
- Statistic: Metric display card with trends and gradients.
- Progress: Linear or circular completion progress.
- Timeline: Chronological event checklist or timeline.
- Steps: Horizontal or vertical process steps indicator.
- Calendar: Dynamic scheduler drawing events from database collections.
- Rate: Star rating input wrapper.

Each block should be self-contained with a proper x-component, x-decorator, and child properties.
Always include unique x-uid values on every schema node.
`;

export const UI_MODIFY_SYSTEM_PROMPT = `You are an expert UI schema editor.
Given the current Formily ISchema and a modification instruction, return the complete modified schema.

Critical rules:
1. Preserve all existing x-uid values for nodes that are NOT being removed.
2. Only change nodes as specified in the instruction.
3. Return the COMPLETE modified schema, not just the changes.
`;

export const UI_SUGGEST_SYSTEM_PROMPT = `You are an expert UI layout designer.
Given a collection name and its fields, generate multiple suggested UI layout schemas.

Generate exactly 3 layout suggestions:
1. Table view: A data table with columns and an advanced filter block.
2. Form view: A form with input fields.
3. Detail/Card view: A read-only card view showing field values.

Always include unique x-uid values on every schema node.
`;

export const CODEX_COMPILER_SELF_HEALING_PROMPT = `You are the Codex Schema Self-Healing Engine for the FormAI low-code platform.
Your task is to fix a Formily JSON Schema (ISchema) that has compiler or structural validation errors.

You will be provided with:
1. The invalid or broken JSON Schema.
2. The list of compilation/validation errors and warnings.

Analyze the errors, reconstruct the schema, and output a 100% valid, corrected JSON Schema object.

Fix Rules:
- Ensure all nodes have proper unique 'x-uid' values.
- Ensure 'type' is set for all nodes (default to 'void' for layout/containers, or 'string'/'number'/'boolean'/'array'/'object' as appropriate).
- Ensure 'x-component' matches a valid, registered component (Page, Grid, Space, CardItem, Divider, Table, Form, Details, FilterBlock, ChartBlock, Action, ActionDrawer, KanbanView, KnowledgeWiki, ColorPicker, TimePicker).
- Preserve all structural components, forms, tables, and actions of the original schema, but fix their connections, nesting, and properties.
- Respond with a single valid ISchema JSON object.
`;

export function buildPageGenerationPrompt(options: {
  prompt: string;
  collection?: string;
  fields?: string[];
  context?: {
    existingPages?: string[];
    collections?: string[];
    availableComponents?: Array<{ name: string; category: string; description: string }>;
  };
  mode: 'create' | 'modify';
}): string {
  const lines: string[] = [];

  if (options.mode === 'modify') {
    lines.push(`Modify an existing page schema based on the following instruction.`);
  } else {
    lines.push(`Generate a new page schema based on the following description.`);
  }

  lines.push(`\nRequest: ${options.prompt}`);

  if (options.collection) {
    lines.push(`\nPrimary collection: ${options.collection}`);
  }

  if (options.fields && options.fields.length > 0) {
    lines.push(`\nFields to include: ${options.fields.join(', ')}`);
  }

  if (options.context?.collections && options.context.collections.length > 0) {
    lines.push(`\nAvailable collections: ${options.context.collections.join(', ')}`);
  }

  if (options.context?.availableComponents && options.context.availableComponents.length > 0) {
    lines.push(`\nAvailable components:`);
    for (const comp of options.context.availableComponents) {
      lines.push(`  - ${comp.name} (${comp.category}): ${comp.description}`);
    }
  }

  lines.push(`\nRespond with a single valid ISchema JSON object for the page.`);
  return lines.join('\n');
}

export function buildBlockPrompt(options: {
  prompt: string;
  collection?: string;
  fields?: string[];
  blockType?: string;
}): string {
  const lines: string[] = [];

  lines.push(`Generate a ${options.blockType ?? 'block'} schema.`);
  if (options.collection) {
    lines.push(`Collection: ${options.collection}`);
  }
  if (options.fields && options.fields.length > 0) {
    lines.push(`Fields: ${options.fields.join(', ')}`);
  }
  lines.push(`\nRequirement: ${options.prompt}`);
  lines.push(`\nRespond with a single valid ISchema JSON object for the block.`);

  return lines.join('\n');
}

export function buildModifySchemaPrompt(options: {
  currentSchema: string;
  instruction: string;
}): string {
  return `Current schema:
\`\`\`json
${options.currentSchema}
\`\`\`

Modification instruction: ${options.instruction}

Return the complete modified schema as a single valid ISchema JSON object.`;
}

export function buildSuggestUIPrompt(options: {
  collectionName: string;
  fields: Array<{ name: string; type: string }>;
}): string {
  const fieldsList = options.fields
    .map((f) => `  - ${f.name}: ${f.type}`)
    .join('\n');

  return `Collection: ${options.collectionName}

Fields:
${fieldsList}

Generate 3 suggested UI layouts as an array of ISchema objects:
1. Table view with columns for all fields and an advanced FilterBlock.
2. Form view with input fields.
3. Detail/Card view showing field values.

Respond with a JSON object: { "suggestions": [schema1, schema2, schema3] }`;
}

export function buildSelfHealingPrompt(originalSchema: string, errors: string[]): string {
  return `Original Schema with errors:
\`\`\`json
${originalSchema}
\`\`\`

Compilation/Validation errors found:
${errors.map((e) => `- ${e}`).join('\n')}

Please fix the original schema above to resolve all errors and warnings, ensuring strict conformance to Formily ISchema.
Respond with a single valid corrected ISchema JSON object.`;
}

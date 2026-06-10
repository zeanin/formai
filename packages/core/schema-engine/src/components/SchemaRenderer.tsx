import React, { useMemo, useState } from 'react';
import { ISchema } from '@formai/shared';
import { ComponentRegistry } from '../registry';
import { ComponentRegistryContext, useComponentRegistry } from '../hooks/useComponentRegistry';
import { DesignableContext, DesignableContextValue } from '../hooks/useDesignable';
import { SchemaComponent } from './SchemaComponent';

export interface SchemaRendererProps {
  schema: ISchema;
  components?: Record<string, React.ComponentType<any>>;
  scope?: Record<string, any>;
  designable?: boolean;
  onPatch?: DesignableContextValue['onPatch'];
  onRemove?: DesignableContextValue['onRemove'];
  onInsert?: DesignableContextValue['onInsert'];
  onSelectBlock?: DesignableContextValue['onSelectBlock'];
  onMove?: DesignableContextValue['onMove'];
}

/**
 * Recursively renders a schema tree.
 *
 * For each node:
 * 1. Check x-visible / x-display for visibility
 * 2. Look up x-component in the registry
 * 3. If x-decorator exists, wrap with decorator component
 * 4. Recursively render properties (children)
 * 5. Handle items for array type schemas
 *
 * When designable=true, injects DesignableContext so every
 * SchemaComponent can show design-time overlays.
 */
export const SchemaRenderer: React.FC<SchemaRendererProps> = ({
  schema,
  components,
  scope: _scope,
  designable = false,
  onPatch,
  onRemove,
  onInsert,
  onSelectBlock,
  onMove,
}) => {
  const parentRegistry = useComponentRegistry();
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);

  // If extra components provided, build a merged registry
  const registry = useMemo(() => {
    if (!components || Object.keys(components).length === 0) {
      return parentRegistry;
    }
    const merged = new ComponentRegistry();
    // Copy parent entries
    for (const [name, reg] of parentRegistry.getAll().entries()) {
      merged.register(name, reg);
    }
    // Register additional components
    for (const [name, comp] of Object.entries(components)) {
      merged.register(name, { component: comp });
    }
    return merged;
  }, [parentRegistry, components]);

  // Build the DesignableContext value — stable reference via useMemo
  const designableContextValue = useMemo<DesignableContextValue>(
    () => ({
      designable,
      setDesignable: () => {},
      onPatch,
      onRemove,
      onInsert,
      onSelectBlock,
      hoveredUid,
      setHoveredUid,
      onMove,
    }),
    [designable, onPatch, onRemove, onInsert, onSelectBlock, hoveredUid, onMove],
  );

  return (
    <ComponentRegistryContext.Provider value={registry}>
      <DesignableContext.Provider value={designableContextValue}>
        <SchemaNode schema={schema} />
      </DesignableContext.Provider>
    </ComponentRegistryContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Internal recursive node renderer
// ---------------------------------------------------------------------------

interface SchemaNodeProps {
  schema: ISchema;
  name?: string;
}

const SchemaNode: React.FC<SchemaNodeProps> = ({ schema, name }) => {
  // Visibility: x-visible=false or x-display='none' hides the node entirely
  if (schema['x-visible'] === false || schema['x-display'] === 'none') {
    return null;
  }

  // Render children (properties)
  const childNodes = renderProperties(schema);

  return React.createElement(SchemaComponent, { schema, name, key: schema['x-uid'] }, childNodes);
};

/**
 * Render schema.properties as an array of SchemaNode elements.
 */
function renderProperties(schema: ISchema): React.ReactNode {
  const nodes: React.ReactElement[] = [];

  if (schema.properties) {
    // Sort by x-index if present, and always push 'actions' to the very end
    const entries = Object.entries(schema.properties).sort(([keyA, a], [keyB, b]) => {
      // FilterBlock always goes first
      const aIsFilter = a['x-component'] === 'FilterBlock';
      const bIsFilter = b['x-component'] === 'FilterBlock';
      if (aIsFilter && !bIsFilter) return -1;
      if (bIsFilter && !aIsFilter) return 1;

      // Space/actionBar always goes before Table/KanbanView/etc.
      const aIsActionBar = a['x-component'] === 'Space' || keyA.toLowerCase().includes('actionbar');
      const bIsActionBar = b['x-component'] === 'Space' || keyB.toLowerCase().includes('actionbar');
      const aIsMainContent = a['x-component'] === 'Table' || a['x-component'] === 'KanbanView' || a['x-component'] === 'KnowledgeWiki';
      const bIsMainContent = b['x-component'] === 'Table' || b['x-component'] === 'KanbanView' || b['x-component'] === 'KnowledgeWiki';

      if (aIsActionBar && bIsMainContent) return -1;
      if (bIsActionBar && aIsMainContent) return 1;

      if (keyA === 'actions' && keyB !== 'actions') return 1;
      if (keyB === 'actions' && keyA !== 'actions') return -1;

      const ai = a['x-index'] ?? 0;
      const bi = b['x-index'] ?? 0;
      return ai - bi;
    });

    for (const [key, child] of entries) {
      const uid = child['x-uid'] || key;
      nodes.push(React.createElement(SchemaNode, { schema: child, name: key, key: uid }));
    }
  }

  // Handle array items
  if (schema.type === 'array' && schema.items) {
    nodes.push(
      React.createElement(SchemaNode, {
        schema: schema.items,
        key: schema.items['x-uid'] || 'items',
      }),
    );
  }

  return nodes.length > 0 ? nodes : undefined;
}

import { ISchema, uid } from '@formai/shared';

export class Schema {
  private data: ISchema;

  constructor(schema: ISchema) {
    this.data = { ...schema };
    if (!this.data['x-uid']) {
      this.data['x-uid'] = uid();
    }
  }

  get type() {
    return this.data.type;
  }

  get name() {
    return this.data.name;
  }

  get title() {
    return this.data.title;
  }

  get component() {
    return this.data['x-component'];
  }

  get componentProps(): Record<string, any> {
    return this.data['x-component-props'] || {};
  }

  get decorator() {
    return this.data['x-decorator'];
  }

  get decoratorProps(): Record<string, any> {
    return this.data['x-decorator-props'] || {};
  }

  get properties() {
    return this.data.properties;
  }

  get uid() {
    return this.data['x-uid'];
  }

  get visible(): boolean {
    return this.data['x-visible'] !== false;
  }

  get pattern(): string {
    return this.data['x-pattern'] || 'editable';
  }

  toJSON(): ISchema {
    return this.data;
  }

  /**
   * Traverse the schema tree, calling callback for each node.
   */
  static traverse(
    schema: ISchema,
    callback: (schema: ISchema, path: string) => void,
    path = '',
  ): void {
    callback(schema, path);
    if (schema.properties) {
      for (const [key, child] of Object.entries(schema.properties)) {
        const childPath = path ? `${path}.properties.${key}` : `properties.${key}`;
        Schema.traverse(child, callback, childPath);
      }
    }
    if (schema.items) {
      Schema.traverse(schema.items, callback, path ? `${path}.items` : 'items');
    }
  }

  /**
   * Find a schema node by its x-uid.
   */
  static findByUid(schema: ISchema, targetUid: string): ISchema | null {
    if (schema['x-uid'] === targetUid) {
      return schema;
    }
    if (schema.properties) {
      for (const child of Object.values(schema.properties)) {
        const found = Schema.findByUid(child, targetUid);
        if (found) return found;
      }
    }
    if (schema.items) {
      const found = Schema.findByUid(schema.items, targetUid);
      if (found) return found;
    }
    return null;
  }

  /**
   * Insert a new node after the target node (as a sibling in parent's properties).
   * Returns a new schema tree (immutable).
   */
  static insertAfter(schema: ISchema, targetUid: string, newNode: ISchema): ISchema {
    if (!schema.properties) {
      return schema;
    }

    const entries = Object.entries(schema.properties);
    const targetIdx = entries.findIndex(([, v]) => v['x-uid'] === targetUid);

    if (targetIdx !== -1) {
      // Found at this level — insert after target
      const newKey = newNode.name || newNode['x-uid'] || uid();
      const nodeWithUid: ISchema = newNode['x-uid'] ? newNode : { ...newNode, 'x-uid': uid() };
      const newEntries: Array<[string, ISchema]> = [];
      for (let i = 0; i < entries.length; i++) {
        newEntries.push(entries[i]);
        if (i === targetIdx) {
          newEntries.push([newKey, nodeWithUid]);
        }
      }
      return {
        ...schema,
        properties: Object.fromEntries(newEntries),
      };
    }

    // Recurse into children
    const newProperties: Record<string, ISchema> = {};
    for (const [key, child] of entries) {
      newProperties[key] = Schema.insertAfter(child, targetUid, newNode);
    }
    return { ...schema, properties: newProperties };
  }

  /**
   * Remove a node by uid. Returns a new schema tree (immutable).
   */
  static remove(schema: ISchema, targetUid: string): ISchema {
    if (!schema.properties) {
      return schema;
    }

    const entries = Object.entries(schema.properties);
    const hasTarget = entries.some(([, v]) => v['x-uid'] === targetUid);

    if (hasTarget) {
      const newProperties: Record<string, ISchema> = {};
      for (const [key, child] of entries) {
        if (child['x-uid'] !== targetUid) {
          newProperties[key] = child;
        }
      }
      return { ...schema, properties: newProperties };
    }

    // Recurse into children
    const newProperties: Record<string, ISchema> = {};
    for (const [key, child] of entries) {
      newProperties[key] = Schema.remove(child, targetUid);
    }
    return { ...schema, properties: newProperties };
  }

  /**
   * Update a node's properties by uid. Returns a new schema tree (immutable).
   */
  static update(schema: ISchema, targetUid: string, patch: Partial<ISchema>): ISchema {
    if (schema['x-uid'] === targetUid) {
      return { ...schema, ...patch };
    }

    if (schema.properties) {
      const newProperties: Record<string, ISchema> = {};
      let changed = false;
      for (const [key, child] of Object.entries(schema.properties)) {
        const updated = Schema.update(child, targetUid, patch);
        newProperties[key] = updated;
        if (updated !== child) changed = true;
      }
      if (changed) {
        return { ...schema, properties: newProperties };
      }
    }

    if (schema.items) {
      const updatedItems = Schema.update(schema.items, targetUid, patch);
      if (updatedItems !== schema.items) {
        return { ...schema, items: updatedItems };
      }
    }

    return schema;
  }

  /**
   * Deep clone a schema.
   */
  static clone(schema: ISchema): ISchema {
    return JSON.parse(JSON.stringify(schema));
  }
}

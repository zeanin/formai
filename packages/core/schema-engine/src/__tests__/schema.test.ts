import { describe, it, expect, beforeEach } from 'vitest';
import { ISchema } from '@formai/shared';
import { Schema } from '../schema';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSchema(): ISchema {
  return {
    type: 'object',
    'x-uid': 'root',
    title: 'Root',
    properties: {
      name: {
        type: 'string',
        title: 'Name',
        'x-uid': 'uid-name',
        'x-component': 'Input',
      },
      age: {
        type: 'number',
        title: 'Age',
        'x-uid': 'uid-age',
        'x-component': 'NumberInput',
      },
      address: {
        type: 'object',
        title: 'Address',
        'x-uid': 'uid-address',
        properties: {
          city: {
            type: 'string',
            title: 'City',
            'x-uid': 'uid-city',
            'x-component': 'Input',
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Schema class instantiation
// ---------------------------------------------------------------------------

describe('Schema class', () => {
  it('should auto-assign x-uid when not provided', () => {
    const s = new Schema({ type: 'string' });
    expect(s.uid).toBeTruthy();
    expect(typeof s.uid).toBe('string');
  });

  it('should preserve existing x-uid', () => {
    const s = new Schema({ type: 'string', 'x-uid': 'my-uid' });
    expect(s.uid).toBe('my-uid');
  });

  it('should expose type, title, component', () => {
    const s = new Schema({
      type: 'string',
      title: 'Field',
      'x-component': 'Input',
      'x-component-props': { placeholder: 'Enter...' },
    });
    expect(s.type).toBe('string');
    expect(s.title).toBe('Field');
    expect(s.component).toBe('Input');
    expect(s.componentProps).toEqual({ placeholder: 'Enter...' });
  });

  it('should default componentProps to empty object', () => {
    const s = new Schema({ type: 'string' });
    expect(s.componentProps).toEqual({});
  });

  it('visible defaults to true', () => {
    const s = new Schema({ type: 'string' });
    expect(s.visible).toBe(true);
  });

  it('visible is false when x-visible=false', () => {
    const s = new Schema({ type: 'string', 'x-visible': false });
    expect(s.visible).toBe(false);
  });

  it('pattern defaults to editable', () => {
    const s = new Schema({ type: 'string' });
    expect(s.pattern).toBe('editable');
  });

  it('toJSON returns the underlying data', () => {
    const data: ISchema = { type: 'string', 'x-uid': 'test', title: 'Test' };
    const s = new Schema(data);
    expect(s.toJSON()).toMatchObject(data);
  });
});

// ---------------------------------------------------------------------------
// Schema.traverse
// ---------------------------------------------------------------------------

describe('Schema.traverse', () => {
  it('should visit every node in the tree', () => {
    const schema = makeSchema();
    const visited: string[] = [];
    Schema.traverse(schema, (node) => {
      if (node['x-uid']) visited.push(node['x-uid']);
    });
    expect(visited).toContain('root');
    expect(visited).toContain('uid-name');
    expect(visited).toContain('uid-age');
    expect(visited).toContain('uid-address');
    expect(visited).toContain('uid-city');
  });

  it('should include path information', () => {
    const schema = makeSchema();
    const paths: string[] = [];
    Schema.traverse(schema, (_, path) => paths.push(path));
    expect(paths[0]).toBe('');
    expect(paths.some((p) => p.includes('properties'))).toBe(true);
  });

  it('should traverse items for array type', () => {
    const schema: ISchema = {
      type: 'array',
      'x-uid': 'arr',
      items: {
        type: 'string',
        'x-uid': 'arr-item',
      },
    };
    const visited: string[] = [];
    Schema.traverse(schema, (node) => {
      if (node['x-uid']) visited.push(node['x-uid']);
    });
    expect(visited).toContain('arr-item');
  });
});

// ---------------------------------------------------------------------------
// Schema.findByUid
// ---------------------------------------------------------------------------

describe('Schema.findByUid', () => {
  let schema: ISchema;
  beforeEach(() => { schema = makeSchema(); });

  it('should find the root node', () => {
    const found = Schema.findByUid(schema, 'root');
    expect(found).not.toBeNull();
    expect(found?.['x-uid']).toBe('root');
  });

  it('should find a top-level property', () => {
    const found = Schema.findByUid(schema, 'uid-name');
    expect(found?.title).toBe('Name');
  });

  it('should find a nested property', () => {
    const found = Schema.findByUid(schema, 'uid-city');
    expect(found?.title).toBe('City');
  });

  it('should return null for unknown uid', () => {
    expect(Schema.findByUid(schema, 'does-not-exist')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Schema.insertAfter
// ---------------------------------------------------------------------------

describe('Schema.insertAfter', () => {
  it('should insert a new node after the target sibling', () => {
    const schema = makeSchema();
    const newNode: ISchema = { type: 'string', 'x-uid': 'uid-email', title: 'Email', name: 'email' };
    const updated = Schema.insertAfter(schema, 'uid-name', newNode);

    const keys = Object.keys(updated.properties!);
    const nameIdx = keys.indexOf('name');
    const emailIdx = keys.indexOf('email');

    expect(emailIdx).toBe(nameIdx + 1);
  });

  it('should insert into nested properties', () => {
    const schema = makeSchema();
    const newNode: ISchema = { type: 'string', 'x-uid': 'uid-zip', title: 'ZIP', name: 'zip' };
    const updated = Schema.insertAfter(schema, 'uid-city', newNode);

    const addressProps = updated.properties!['address'].properties!;
    expect(Object.keys(addressProps)).toContain('zip');
  });

  it('should not mutate the original schema', () => {
    const schema = makeSchema();
    const original = JSON.stringify(schema);
    Schema.insertAfter(schema, 'uid-name', { type: 'string', 'x-uid': 'new', name: 'new' });
    expect(JSON.stringify(schema)).toBe(original);
  });

  it('should auto-assign uid to new node if missing', () => {
    const schema = makeSchema();
    const newNode: ISchema = { type: 'string', title: 'No UID', name: 'nouid' };
    const updated = Schema.insertAfter(schema, 'uid-name', newNode);
    const inserted = updated.properties!['nouid'];
    expect(inserted['x-uid']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Schema.remove
// ---------------------------------------------------------------------------

describe('Schema.remove', () => {
  it('should remove a top-level property', () => {
    const schema = makeSchema();
    const updated = Schema.remove(schema, 'uid-age');
    expect(updated.properties).not.toHaveProperty('age');
    expect(updated.properties).toHaveProperty('name');
  });

  it('should remove a nested property', () => {
    const schema = makeSchema();
    const updated = Schema.remove(schema, 'uid-city');
    const addressProps = updated.properties!['address'].properties;
    expect(addressProps).not.toHaveProperty('city');
  });

  it('should not mutate the original schema', () => {
    const schema = makeSchema();
    const original = JSON.stringify(schema);
    Schema.remove(schema, 'uid-name');
    expect(JSON.stringify(schema)).toBe(original);
  });

  it('should return unchanged schema when uid not found', () => {
    const schema = makeSchema();
    const updated = Schema.remove(schema, 'ghost-uid');
    expect(JSON.stringify(updated)).toBe(JSON.stringify(schema));
  });
});

// ---------------------------------------------------------------------------
// Schema.update
// ---------------------------------------------------------------------------

describe('Schema.update', () => {
  it('should update the root node', () => {
    const schema = makeSchema();
    const updated = Schema.update(schema, 'root', { title: 'Updated Root' });
    expect(updated.title).toBe('Updated Root');
  });

  it('should update a nested node', () => {
    const schema = makeSchema();
    const updated = Schema.update(schema, 'uid-city', { title: 'Updated City', 'x-disabled': true });
    const city = updated.properties!['address'].properties!['city'];
    expect(city.title).toBe('Updated City');
    expect(city['x-disabled']).toBe(true);
  });

  it('should not mutate the original', () => {
    const schema = makeSchema();
    const original = JSON.stringify(schema);
    Schema.update(schema, 'uid-name', { title: 'Changed' });
    expect(JSON.stringify(schema)).toBe(original);
  });

  it('should return same reference when uid not found', () => {
    const schema = makeSchema();
    const updated = Schema.update(schema, 'ghost', { title: 'x' });
    expect(updated).toBe(schema);
  });
});

// ---------------------------------------------------------------------------
// Schema.clone
// ---------------------------------------------------------------------------

describe('Schema.clone', () => {
  it('should produce a deep copy', () => {
    const schema = makeSchema();
    const cloned = Schema.clone(schema);
    expect(cloned).toEqual(schema);
    expect(cloned).not.toBe(schema);
    expect(cloned.properties).not.toBe(schema.properties);
  });

  it('should not share nested references', () => {
    const schema = makeSchema();
    const cloned = Schema.clone(schema);
    cloned.properties!['name'].title = 'Mutated';
    expect(schema.properties!['name'].title).toBe('Name');
  });
});

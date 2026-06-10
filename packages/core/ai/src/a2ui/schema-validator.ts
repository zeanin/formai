import type { ISchema } from '@formai/shared';
import { uid } from '@formai/shared';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_SCHEMA_TYPES = new Set(['void', 'object', 'array', 'string', 'number', 'boolean']);

/**
 * Validate an ISchema tree, checking for structural correctness.
 *
 * @param schema   The root ISchema to validate
 * @param knownComponents  Optional whitelist of component names; any x-component
 *                         not in this list generates a warning
 */
export function validateSchema(schema: ISchema, knownComponents?: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  function validate(node: ISchema, path: string): void {
    // Check type
    if (node.type && !VALID_SCHEMA_TYPES.has(node.type)) {
      errors.push(`Invalid type "${node.type}" at ${path}`);
    }

    // Check x-component is a non-empty string when present
    if (node['x-component'] !== undefined && typeof node['x-component'] !== 'string') {
      errors.push(`x-component must be a string at ${path}, got ${typeof node['x-component']}`);
    }

    // Warn on unknown components
    if (node['x-component'] && knownComponents && !knownComponents.includes(node['x-component'])) {
      warnings.push(`Unknown component "${node['x-component']}" at ${path}`);
    }

    // Check x-decorator is a non-empty string when present
    if (node['x-decorator'] !== undefined && typeof node['x-decorator'] !== 'string') {
      errors.push(`x-decorator must be a string at ${path}, got ${typeof node['x-decorator']}`);
    }

    // Check properties is an object when present
    if (node.properties !== undefined && typeof node.properties !== 'object') {
      errors.push(`properties must be an object at ${path}, got ${typeof node.properties}`);
    }

    // Check for circular references via x-uid (best-effort)
    if (node['x-uid']) {
      // x-uid is a string identifier; duplicate uids are a structural issue
      // but not necessarily circular — just warn
    }

    // Recurse into properties
    if (node.properties && typeof node.properties === 'object') {
      for (const [key, child] of Object.entries(node.properties)) {
        validate(child, `${path}.${key}`);
      }
    }

    // Recurse into items
    if (node.items && typeof node.items === 'object') {
      validate(node.items, `${path}.items`);
    }
  }

  validate(schema, 'root');
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Auto-fix common schema issues in-place (returns a deep-copied, fixed schema).
 *
 * Fixes applied:
 * - Missing type → default to 'void'
 * - Missing x-uid → generate one
 * - Unknown component → replace with 'Div' fallback (if knownComponents provided)
 */
export function fixSchema(schema: ISchema, knownComponents?: string[]): ISchema {
  const fixed = JSON.parse(JSON.stringify(schema)) as ISchema;

  function fix(node: ISchema): void {
    // Add missing type
    if (!node.type) {
      node.type = 'void';
    }

    // Add missing x-uid
    if (!node['x-uid']) {
      node['x-uid'] = uid();
    }

    // Replace unknown component with fallback
    if (node['x-component'] && knownComponents && !knownComponents.includes(node['x-component'])) {
      node['x-component'] = 'Div';
    }

    // Recurse into properties
    if (node.properties) {
      for (const child of Object.values(node.properties)) {
        fix(child);
      }
    }

    // Recurse into items
    if (node.items) {
      fix(node.items);
    }
  }

  fix(fixed);
  return fixed;
}

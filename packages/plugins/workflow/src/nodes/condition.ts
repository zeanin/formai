import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Condition node — evaluates an expression or a field comparison and routes
 * execution to either the "true" (branch 0) or "false" (branch 1) downstream.
 *
 * config:
 *   expression?: string          — arbitrary JS expression (receives `ctx`)
 *   field?:      string          — key path into triggerData / jobResults
 *   operator?:   string          — 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'notContains'
 *   value?:      any             — right-hand side for operator comparison
 *   trueBranch?:  string         — nodeId to execute when condition is true
 *   falseBranch?: string         — nodeId to execute when condition is false
 */
export class ConditionNode implements NodeHandler {
  readonly type = 'condition';

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<JobResult> {
    const { expression, field, operator, value, trueBranch, falseBranch } = node.config ?? {};

    let result = false;

    if (expression) {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('ctx', `"use strict"; return (${expression});`);
        result = Boolean(fn(context));
      } catch {
        result = false;
      }
    } else if (field !== undefined) {
      const actual = getFieldValue(field, context);
      result = evaluate(actual, operator ?? 'eq', value);
    }

    const nextNodes: string[] = [];
    if (result && trueBranch) {
      if (Array.isArray(trueBranch)) {
        nextNodes.push(...trueBranch);
      } else {
        nextNodes.push(trueBranch);
      }
    }
    if (!result && falseBranch) {
      if (Array.isArray(falseBranch)) {
        nextNodes.push(...falseBranch);
      } else {
        nextNodes.push(falseBranch);
      }
    }

    return {
      status: 'resolved',
      result: { condition: result, branchIndex: result ? 0 : 1 },
      nextNodes,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFieldValue(field: string, context: ExecutionContext): any {
  const parts = field.split('.');
  const root = parts[0];
  const rest = parts.slice(1);

  let base: any;
  if (root === 'triggerData') {
    base = context.triggerData;
  } else {
    base = context.getNodeResult(root) ?? context.getVariable(root);
  }

  return rest.reduce((acc, key) => acc?.[key], base);
}

function evaluate(actual: any, operator: string, expected: any): boolean {
  switch (operator) {
    case 'eq':
      return actual == expected; // intentional loose equality
    case 'ne':
      return actual != expected;
    case 'gt':
      return actual > expected;
    case 'lt':
      return actual < expected;
    case 'gte':
      return actual >= expected;
    case 'lte':
      return actual <= expected;
    case 'contains':
      return String(actual).includes(String(expected));
    case 'notContains':
      return !String(actual).includes(String(expected));
    default:
      return Boolean(actual);
  }
}

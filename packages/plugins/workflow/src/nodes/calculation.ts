import type { NodeHandler, WorkflowNode, JobResult } from './base';
import type { ExecutionContext } from '../engine/context';

/**
 * Calculation node — evaluates a JavaScript expression.
 *
 * config:
 *   expression: string  — JS expression. Receives `ctx` (ExecutionContext) and
 *                         `triggerData`, `vars`, `results` as convenience aliases.
 *   resultKey?: string  — if set, stores result as a variable with this key
 */
export class CalculationNode implements NodeHandler {
  readonly type = 'calculation';

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<JobResult> {
    const { expression, resultKey } = node.config ?? {};

    if (!expression) {
      return { status: 'rejected', result: { error: 'expression is required' } };
    }

    let value: any;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        'ctx',
        'triggerData',
        'vars',
        'results',
        `"use strict"; return (${expression});`,
      );
      value = fn(
        context,
        context.triggerData,
        context.getVariables(),
        Object.fromEntries(context.jobResults),
      );
    } catch (err: any) {
      return { status: 'rejected', result: { error: err.message } };
    }

    if (resultKey) {
      context.setVariable(resultKey, value);
    }

    return { status: 'resolved', result: { value } };
  }
}

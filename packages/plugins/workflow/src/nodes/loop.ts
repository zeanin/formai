import type { NodeHandler, WorkflowNode, JobResult } from './base';
import { ExecutionContext } from '../engine/context';

/**
 * Loop node — iterates over an array, executing child nodes for each item.
 *
 * config:
 *   target:      string    — expression or node result key that resolves to an array
 *   itemVar?:    string    — variable name for current item (default: 'item')
 *   indexVar?:   string    — variable name for current index (default: 'index')
 *   childNodes?: string[]  — node IDs to execute per iteration
 *                            (the executor handles child execution; here we just
 *                             resolve the array and return results)
 */
export class LoopNode implements NodeHandler {
  readonly type = 'loop';

  async execute(node: WorkflowNode, context: ExecutionContext): Promise<JobResult> {
    const { target, itemVar = 'item', indexVar = 'index' } = node.config ?? {};

    // Resolve the target array
    let items: any[] = [];
    if (target) {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(
          'ctx',
          'triggerData',
          'vars',
          'results',
          `"use strict"; return (${target});`,
        );
        const resolved = fn(
          context,
          context.triggerData,
          context.getVariables(),
          Object.fromEntries(context.jobResults),
        );
        items = Array.isArray(resolved) ? resolved : [];
      } catch {
        items = [];
      }
    }

    // Store items in a variable so child-node executor logic can iterate
    context.setVariable('__loop_items__', items);
    context.setVariable(itemVar, items[0] ?? null);
    context.setVariable(indexVar, 0);

    return {
      status: 'resolved',
      result: { items, count: items.length },
    };
  }
}

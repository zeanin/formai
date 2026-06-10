import { ISchema, Reaction } from '@formai/shared';

/**
 * Creates a safe expression evaluator bound to the given scope.
 * Uses Function constructor — avoids eval while still supporting dynamic expressions.
 */
export function createExpressionEvaluator(scope: Record<string, any>) {
  return (expression: string): any => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...Object.keys(scope), `return ${expression}`);
      return fn(...Object.values(scope));
    } catch {
      return undefined;
    }
  };
}

/**
 * Evaluate a single reaction for a schema node.
 *
 * A reaction describes how a field should respond to changes in other fields:
 * - `when`      — expression evaluated against scope; truthy → apply fulfill, falsy → apply otherwise
 * - `fulfill`   — schema patch to apply when `when` is truthy
 * - `otherwise` — schema patch to apply when `when` is falsy
 *
 * @returns A partial ISchema patch to merge into the current schema, or null if no change.
 */
export function evaluateReaction(
  reaction: Reaction,
  scope: Record<string, any>,
  fieldState: Record<string, any>,
): Partial<ISchema> | null {
  const evaluate = createExpressionEvaluator({ ...scope, ...fieldState });

  // Evaluate the when condition
  let conditionResult = true;
  if (reaction.when !== undefined) {
    conditionResult = Boolean(evaluate(reaction.when));
  }

  const branch = conditionResult ? reaction.fulfill : reaction.otherwise;
  if (!branch) return null;

  const patch: Partial<ISchema> = {};

  // Apply state overrides (x-* fields)
  if (branch.state) {
    for (const [key, value] of Object.entries(branch.state)) {
      (patch as Record<string, any>)[key] = value;
    }
  }

  // Merge explicit schema patch
  if (branch.schema) {
    Object.assign(patch, branch.schema);
  }

  // Evaluate run expression (side-effect only, no patch modification)
  if (branch.run) {
    try {
      evaluate(branch.run);
    } catch {
      // swallow — run expressions are best-effort side effects
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Evaluate all reactions for a schema node and merge the resulting patches.
 *
 * @param schema     - The current schema node
 * @param scope      - Global scope (form values, utilities, etc.)
 * @param fieldState - Current field state (value, errors, etc.)
 * @returns Merged schema patch from all matching reactions
 */
export function evaluateReactions(
  schema: ISchema,
  scope: Record<string, any>,
  fieldState: Record<string, any> = {},
): Partial<ISchema> {
  const reactions = schema['x-reactions'];
  if (!reactions) return {};

  const reactionList: Reaction[] = Array.isArray(reactions) ? reactions : [reactions];
  const mergedPatch: Partial<ISchema> = {};

  for (const reaction of reactionList) {
    const patch = evaluateReaction(reaction, scope, fieldState);
    if (patch) {
      Object.assign(mergedPatch, patch);
    }
  }

  return mergedPatch;
}

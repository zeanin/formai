import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tested units (pure — no DB dependency for most tests)
import { ExecutionContext } from '../engine/context';
import { ConditionNode } from '../nodes/condition';
import { CalculationNode } from '../nodes/calculation';
import { ManualNode } from '../nodes/manual';
import { LoopNode } from '../nodes/loop';
import { ParallelNode } from '../nodes/parallel';
import type { WorkflowNode } from '../nodes/base';
import { NodeRegistry } from '../services/node-registry';
import { TriggerManager } from '../services/trigger-manager';
import { ManualTrigger } from '../triggers/manual-trigger';
import { ScheduleTrigger } from '../triggers/schedule-trigger';
import { WorkflowExecutor } from '../engine/executor';
import { A2FlowEngine } from '../a2flow/engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<{
  executionId: string;
  workflowId: string;
  triggerData: Record<string, any>;
}> = {}): ExecutionContext {
  return new ExecutionContext({
    executionId: overrides.executionId ?? 'exec-1',
    workflowId: overrides.workflowId ?? 'wf-1',
    triggerData: overrides.triggerData ?? {},
  });
}

function makeNode(partial: Partial<WorkflowNode> & { type: string }): WorkflowNode {
  return {
    id: partial.id ?? 'n1',
    type: partial.type,
    config: partial.config ?? {},
    title: partial.title,
    upstreamId: partial.upstreamId,
    downstreamId: partial.downstreamId,
  };
}

// ---------------------------------------------------------------------------
// 1. ExecutionContext
// ---------------------------------------------------------------------------

describe('ExecutionContext', () => {
  it('stores and retrieves variables', () => {
    const ctx = makeCtx();
    ctx.setVariable('foo', 42);
    expect(ctx.getVariable('foo')).toBe(42);
  });

  it('getNodeResult returns undefined for unknown node', () => {
    const ctx = makeCtx();
    expect(ctx.getNodeResult('unknown')).toBeUndefined();
  });

  it('stores job results and retrieves them', () => {
    const ctx = makeCtx();
    ctx.jobResults.set('n1', { value: 'hello' });
    expect(ctx.getNodeResult('n1')).toEqual({ value: 'hello' });
  });

  it('fork shares jobResults and variables', () => {
    const ctx = makeCtx();
    ctx.setVariable('x', 10);
    const child = ctx.fork({});
    child.setVariable('y', 20);
    // parent sees y since it shares the same _variables object... actually fork copies variables
    // fork creates a new ctx but with same jobResults reference
    expect(child.getVariable('x')).toBe(10);
    ctx.jobResults.set('shared', 'data');
    expect(child.getNodeResult('shared')).toBe('data');
  });
});

// ---------------------------------------------------------------------------
// 2. ConditionNode
// ---------------------------------------------------------------------------

describe('ConditionNode', () => {
  const node = new ConditionNode();

  it('evaluates JS expression to true', async () => {
    const ctx = makeCtx({ triggerData: { score: 90 } });
    const wfNode = makeNode({
      type: 'condition',
      config: { expression: 'ctx.triggerData.score > 50', trueBranch: 'n2', falseBranch: 'n3' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('resolved');
    expect(result.result.condition).toBe(true);
    expect(result.nextNodes).toEqual(['n2']);
  });

  it('evaluates JS expression to false and routes to false branch', async () => {
    const ctx = makeCtx({ triggerData: { score: 10 } });
    const wfNode = makeNode({
      type: 'condition',
      config: { expression: 'ctx.triggerData.score > 50', trueBranch: 'n2', falseBranch: 'n3' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.result.condition).toBe(false);
    expect(result.nextNodes).toEqual(['n3']);
  });

  it('evaluates field operator comparison (eq)', async () => {
    const ctx = makeCtx({ triggerData: { status: 'active' } });
    const wfNode = makeNode({
      type: 'condition',
      config: {
        field: 'triggerData.status',
        operator: 'eq',
        value: 'active',
        trueBranch: 'yes',
        falseBranch: 'no',
      },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.result.condition).toBe(true);
    expect(result.nextNodes).toEqual(['yes']);
  });

  it('supports array-based trueBranch and falseBranch routing', async () => {
    const ctx = makeCtx({ triggerData: { score: 90 } });
    const wfNode1 = makeNode({
      type: 'condition',
      config: { expression: 'ctx.triggerData.score > 50', trueBranch: ['n2'], falseBranch: ['n3'] },
    });
    const result1 = await node.execute(wfNode1, ctx);
    expect(result1.nextNodes).toEqual(['n2']);

    const ctx2 = makeCtx({ triggerData: { score: 10 } });
    const wfNode2 = makeNode({
      type: 'condition',
      config: { expression: 'ctx.triggerData.score > 50', trueBranch: ['n2'], falseBranch: ['n3'] },
    });
    const result2 = await node.execute(wfNode2, ctx2);
    expect(result2.nextNodes).toEqual(['n3']);
  });

  it('returns empty nextNodes when no branches configured', async () => {
    const ctx = makeCtx();
    const wfNode = makeNode({ type: 'condition', config: { expression: 'true' } });
    const result = await node.execute(wfNode, ctx);
    expect(result.nextNodes).toEqual([]);
  });

  it('handles expression error gracefully', async () => {
    const ctx = makeCtx();
    const wfNode = makeNode({
      type: 'condition',
      config: { expression: 'this_will_throw(', falseBranch: 'n3' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.result.condition).toBe(false);
    expect(result.nextNodes).toEqual(['n3']);
  });
});

// ---------------------------------------------------------------------------
// 3. CalculationNode
// ---------------------------------------------------------------------------

describe('CalculationNode', () => {
  const node = new CalculationNode();

  it('evaluates a simple expression', async () => {
    const ctx = makeCtx({ triggerData: { a: 3, b: 4 } });
    const wfNode = makeNode({
      type: 'calculation',
      config: { expression: 'triggerData.a + triggerData.b' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('resolved');
    expect(result.result.value).toBe(7);
  });

  it('stores result as a variable when resultKey is set', async () => {
    const ctx = makeCtx();
    const wfNode = makeNode({
      type: 'calculation',
      config: { expression: '2 * 21', resultKey: 'answer' },
    });
    await node.execute(wfNode, ctx);
    expect(ctx.getVariable('answer')).toBe(42);
  });

  it('returns rejected status on syntax error', async () => {
    const ctx = makeCtx();
    const wfNode = makeNode({ type: 'calculation', config: { expression: 'this is invalid!!!' } });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('rejected');
    expect(result.result.error).toBeDefined();
  });

  it('returns rejected when expression is missing', async () => {
    const ctx = makeCtx();
    const wfNode = makeNode({ type: 'calculation', config: {} });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// 4. ManualNode
// ---------------------------------------------------------------------------

describe('ManualNode', () => {
  it('returns pending status with config details', async () => {
    const node = new ManualNode();
    const ctx = makeCtx();
    const wfNode = makeNode({
      type: 'manual',
      config: { assignees: ['user-1'], title: 'Please approve', description: 'Need sign-off' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('pending');
    expect(result.result.assignees).toEqual(['user-1']);
    expect(result.result.title).toBe('Please approve');
  });
});

// ---------------------------------------------------------------------------
// 5. LoopNode
// ---------------------------------------------------------------------------

describe('LoopNode', () => {
  it('resolves array from expression and stores in context', async () => {
    const node = new LoopNode();
    const ctx = makeCtx({ triggerData: { items: [1, 2, 3] } });
    const wfNode = makeNode({
      type: 'loop',
      config: { target: 'triggerData.items' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('resolved');
    expect(result.result.count).toBe(3);
    expect(ctx.getVariable('__loop_items__')).toEqual([1, 2, 3]);
  });

  it('handles non-array gracefully', async () => {
    const node = new LoopNode();
    const ctx = makeCtx({ triggerData: { notAnArray: 'string' } });
    const wfNode = makeNode({
      type: 'loop',
      config: { target: 'triggerData.notAnArray' },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.result.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. ParallelNode
// ---------------------------------------------------------------------------

describe('ParallelNode', () => {
  it('returns first node of each branch as nextNodes', async () => {
    const node = new ParallelNode();
    const ctx = makeCtx();
    const wfNode = makeNode({
      type: 'parallel',
      config: { branches: [['n2', 'n3'], ['n4', 'n5']] },
    });
    const result = await node.execute(wfNode, ctx);
    expect(result.status).toBe('resolved');
    expect(result.nextNodes).toEqual(['n2', 'n4']);
  });
});

// ---------------------------------------------------------------------------
// 7. NodeRegistry
// ---------------------------------------------------------------------------

describe('NodeRegistry', () => {
  it('registers and retrieves handlers', () => {
    const registry = new NodeRegistry();
    const handler = new ConditionNode();
    registry.register(handler);
    expect(registry.get('condition')).toBe(handler);
    expect(registry.has('condition')).toBe(true);
  });

  it('returns undefined for unknown types', () => {
    const registry = new NodeRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('lists all registered types', () => {
    const registry = new NodeRegistry();
    registry.register(new ConditionNode());
    registry.register(new ManualNode());
    expect(registry.list()).toEqual(expect.arrayContaining(['condition', 'manual']));
  });
});

// ---------------------------------------------------------------------------
// 8. WorkflowExecutor — sequential execution
// ---------------------------------------------------------------------------

describe('WorkflowExecutor', () => {
  function makeDb(stores: Record<string, any[]> = {}) {
    const repos: Record<string, any> = {};

    function getRepo(name: string) {
      if (!stores[name]) stores[name] = [];
      if (!repos[name]) {
        repos[name] = {
          create: vi.fn(async ({ values }: any) => {
            const id = values.id ?? `${name}-${stores[name].length + 1}`;
            const record = { ...values, id };
            stores[name].push(record);
            return record;
          }),
          update: vi.fn(async ({ filter, values }: any) => {
            stores[name] = stores[name].map((r) => {
              const matches = Object.entries(filter).every(([k, v]) => r[k] === v);
              return matches ? { ...r, ...values } : r;
            });
            return stores[name];
          }),
          findOne: vi.fn(async ({ filter }: any) => {
            return stores[name].find((r) =>
              Object.entries(filter).every(([k, v]) => r[k] === v),
            ) ?? null;
          }),
          find: vi.fn(async ({ filter }: any = {}) => {
            return stores[name].filter((r) =>
              Object.entries(filter ?? {}).every(([k, v]) => r[k] === v),
            );
          }),
          count: vi.fn(async () => stores[name].length),
        };
      }
      return repos[name];
    }

    return { getRepository: (name: string) => getRepo(name), stores };
  }

  it('executes nodes in order and returns resolved execution', async () => {
    const db = makeDb();
    const registry = new NodeRegistry();
    registry.register(new CalculationNode());

    const executor = new WorkflowExecutor(db, registry);

    const workflow = {
      id: 'wf-1',
      nodes: [
        makeNode({ id: 'n1', type: 'calculation', config: { expression: '1 + 1', resultKey: 'sum' } }),
        makeNode({ id: 'n2', type: 'calculation', config: { expression: '42' }, upstreamId: 'n1' }),
      ] as WorkflowNode[],
    };

    // Link nodes
    (workflow.nodes[0] as WorkflowNode).downstreamId = 'n2';

    const execution = await executor.execute(workflow, { test: true });
    expect(execution.status).toBe('resolved');
  });

  it('pauses when a manual node returns pending', async () => {
    const db = makeDb();
    const registry = new NodeRegistry();
    registry.register(new ManualNode());

    const executor = new WorkflowExecutor(db, registry);

    const workflow = {
      id: 'wf-2',
      nodes: [
        makeNode({ id: 'n1', type: 'manual', config: { title: 'Approve me' } }),
      ] as WorkflowNode[],
    };

    const execution = await executor.execute(workflow, {});
    // Execution stays in "started" state because it is paused
    expect(execution.status).toBe('started');
  });

  it('handles unknown node type by throwing and setting error status', async () => {
    const db = makeDb();
    const registry = new NodeRegistry();
    const executor = new WorkflowExecutor(db, registry);

    const workflow = {
      id: 'wf-3',
      nodes: [makeNode({ id: 'n1', type: 'unknown-type', config: {} })],
    };

    const execution = await executor.execute(workflow, {});
    expect(execution.status).toBe('error');
  });

  it('cancels an execution', async () => {
    const db = makeDb();
    // Pre-seed an execution
    db.stores['executions'] = [{ id: 'exec-99', workflowId: 'wf-1', status: 'started' }];
    const registry = new NodeRegistry();
    const executor = new WorkflowExecutor(db, registry);

    await executor.cancel('exec-99');

    const repo = db.getRepository('executions');
    const exec = await repo.findOne({ filter: { id: 'exec-99' } });
    expect(exec.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// 9. TriggerManager
// ---------------------------------------------------------------------------

describe('TriggerManager', () => {
  it('registers and retrieves trigger implementations', () => {
    const manager = new TriggerManager();
    const trigger = new ManualTrigger();
    manager.registerTrigger(trigger);
    expect(manager.getTrigger('manual')).toBe(trigger);
  });

  it('throws when registering a workflow to unknown trigger type', () => {
    const manager = new TriggerManager();
    expect(() =>
      manager.register('wf-1', 'nonexistent', {}, async () => {}),
    ).toThrow('Unknown trigger type');
  });

  it('fires manual trigger via fireManual', async () => {
    const manager = new TriggerManager();
    const trigger = new ManualTrigger();
    manager.registerTrigger(trigger);

    let firedWith: any = null;
    manager.register('wf-1', 'manual', {}, async (ctx) => {
      firedWith = ctx;
    });

    await manager.fireManual('wf-1', { userId: 'u1' });
    expect(firedWith).not.toBeNull();
    expect(firedWith.input.userId).toBe('u1');
  });

  it('unregisters a trigger', async () => {
    const manager = new TriggerManager();
    const trigger = new ManualTrigger();
    manager.registerTrigger(trigger);

    manager.register('wf-1', 'manual', {}, async () => {});
    manager.unregister('wf-1', 'manual');

    await expect(manager.fireManual('wf-1', {})).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. ScheduleTrigger
// ---------------------------------------------------------------------------

describe('ScheduleTrigger', () => {
  it('fires the callback after the interval', async () => {
    const trigger = new ScheduleTrigger();
    let fired = 0;
    trigger.register('wf-s1', { cron: '100ms' } as any, async () => {
      fired++;
    });

    // The shorthand parser only handles s/m/h/d — "100ms" won't match,
    // so it falls back to 60_000ms (1 min) which won't fire in the test.
    // Instead use the shorthand "1s" to test firing.
    trigger.unregister('wf-s1');

    const trigger2 = new ScheduleTrigger();
    trigger2.register('wf-s2', { cron: '1s' }, async () => {
      fired++;
    });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    trigger2.unregister('wf-s2');

    expect(fired).toBeGreaterThanOrEqual(1);
  }, 5000);
});

// ---------------------------------------------------------------------------
// 11. A2Flow — generates valid workflow with mock LLM
// ---------------------------------------------------------------------------

describe('A2FlowEngine', () => {
  it('generates a valid workflow structure from mock LLM', async () => {
    // Build a minimal mock LLMManager
    const mockWorkflow = {
      title: 'Send notification on new order',
      triggerType: 'collection',
      triggerConfig: { collection: 'orders', event: 'afterCreate' },
      nodes: [
        {
          id: 'n1',
          type: 'http-request',
          title: 'Notify Slack',
          config: { url: 'https://hooks.slack.com/test', method: 'POST', body: { text: 'New order!' } },
        },
      ],
    };

    const mockLlm = {
      generate: vi.fn().mockResolvedValue(mockWorkflow),
    } as any;

    const engine = new A2FlowEngine(mockLlm);
    const result = await engine.generateWorkflow(
      'Send a Slack notification when a new order is created',
      { collections: ['orders', 'users'] },
    );

    expect(result.title).toBe('Send notification on new order');
    expect(result.triggerType).toBe('collection');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('http-request');
  });

  it('passes collections context to the LLM', async () => {
    const mockLlm = {
      generate: vi.fn().mockResolvedValue({
        title: 'Test',
        triggerType: 'manual',
        triggerConfig: {},
        nodes: [],
      }),
    } as any;

    const engine = new A2FlowEngine(mockLlm);
    await engine.generateWorkflow('test prompt', { collections: ['products', 'orders'] });

    const callArgs = mockLlm.generate.mock.calls[0];
    // Second arg is the user prompt; it should contain the collection names
    expect(callArgs[1]).toContain('products');
    expect(callArgs[1]).toContain('orders');
  });
});

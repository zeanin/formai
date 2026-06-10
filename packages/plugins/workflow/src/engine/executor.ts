import { ExecutionContext } from './context';
import type { NodeRegistry } from '../services/node-registry';
import type { WorkflowNode, JobResult } from '../nodes/base';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionStatus = 'started' | 'resolved' | 'rejected' | 'cancelled' | 'error';

export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export function normalizeWorkflowNodes(nodes: any[]): any[] {
  if (!nodes || !Array.isArray(nodes)) return [];
  
  const cloned = nodes.map(n => ({
    ...n,
    config: { ...(n.config ?? {}) }
  }));

  for (const node of cloned) {
    if (node.downstreamId) {
      const target = cloned.find(t => t.id === node.downstreamId);
      if (target && !target.upstreamId) {
        target.upstreamId = node.id;
      }
    }

    if (node.upstreamId) {
      const parent = cloned.find(p => p.id === node.upstreamId);
      if (parent && parent.type !== 'condition' && parent.type !== 'parallel' && !parent.downstreamId) {
        parent.downstreamId = node.id;
      }
    }

    if (node.type === 'condition') {
      const trueBranch = Array.isArray(node.config.trueBranch) ? node.config.trueBranch[0] : node.config.trueBranch;
      const falseBranch = Array.isArray(node.config.falseBranch) ? node.config.falseBranch[0] : node.config.falseBranch;
      
      if (trueBranch) {
        const trueTarget = cloned.find(t => t.id === trueBranch);
        if (trueTarget && !trueTarget.upstreamId) {
          trueTarget.upstreamId = node.id;
        }
      }
      if (falseBranch) {
        const falseTarget = cloned.find(t => t.id === falseBranch);
        if (falseTarget && !falseTarget.upstreamId) {
          falseTarget.upstreamId = node.id;
        }
      }
    }
  }

  return cloned;
}

// ---------------------------------------------------------------------------
// WorkflowExecutor
// ---------------------------------------------------------------------------

export class WorkflowExecutor {
  constructor(
    private db: any,
    private nodeRegistry: NodeRegistry,
  ) {}

  /**
   * Execute a workflow from a trigger context.
   */
  async execute(workflow: any, triggerContext: Record<string, any>): Promise<Execution> {
    // 1. Create execution record
    const executionRepo = this.db.getRepository('executions');
    const executionRecord = await executionRepo.create({
      values: {
        workflowId: workflow.id,
        status: 'started',
        context: triggerContext,
      },
    });

    const nodes: WorkflowNode[] = normalizeWorkflowNodes(workflow.nodes ?? []);
    const ctx = new ExecutionContext({
      executionId: executionRecord.id,
      workflowId: workflow.id,
      triggerData: triggerContext,
    });

    try {
      // 2. Find first node (no upstreamId)
      const firstNode = nodes.find((n) => !n.upstreamId);
      if (!firstNode) {
        await this.updateExecutionStatus(executionRecord.id, 'resolved');
        return { ...executionRecord, status: 'resolved' };
      }

      // 3. Execute nodes sequentially / in parallel based on graph
      const finalStatus = await this.runNode(firstNode, nodes, ctx);

      await this.updateExecutionStatus(executionRecord.id, finalStatus);
      return { ...executionRecord, status: finalStatus };
    } catch (err: any) {
      await this.updateExecutionStatus(executionRecord.id, 'error');
      return { ...executionRecord, status: 'error' };
    }
  }

  /**
   * Execute a single node and continue traversal.
   * Returns the final execution status.
   */
  private async runNode(
    node: WorkflowNode,
    allNodes: WorkflowNode[],
    context: ExecutionContext,
  ): Promise<ExecutionStatus> {
    const jobResult = await this.executeNode(node, context);

    // Store result in context so downstream nodes can read it
    context.jobResults.set(node.id, jobResult.result);

    // Paused for manual approval
    if (jobResult.status === 'pending') {
      return 'started'; // execution paused, will be resumed later
    }

    if (jobResult.status === 'rejected') {
      return 'rejected';
    }

    // Determine next node(s)
    const nextIds = jobResult.nextNodes ?? (node.downstreamId ? [node.downstreamId] : []);

    if (nextIds.length === 0) {
      return 'resolved';
    }

    if (nextIds.length === 1) {
      const next = allNodes.find((n) => n.id === nextIds[0]);
      if (!next) return 'resolved';
      return this.runNode(next, allNodes, context);
    }

    // Parallel branches — run concurrently, wait for all
    const results = await Promise.all(
      nextIds.map((id) => {
        const next = allNodes.find((n) => n.id === id);
        if (!next) return Promise.resolve<ExecutionStatus>('resolved');
        return this.runNode(next, allNodes, context);
      }),
    );

    if (results.some((s) => s === 'error')) return 'error';
    if (results.some((s) => s === 'rejected')) return 'rejected';
    if (results.some((s) => s === 'started')) return 'started';
    return 'resolved';
  }

  /**
   * Execute a single node using the handler from the registry.
   */
  private async executeNode(node: WorkflowNode, context: ExecutionContext): Promise<JobResult> {
    const handler = this.nodeRegistry.get(node.type);
    if (!handler) {
      throw new Error(`Unknown node type: "${node.type}"`);
    }

    // Dynamic recursive variable interpolation!
    const resolvedConfig = resolveConfigVariables(node.config || {}, context);
    const resolvedNode = {
      ...node,
      config: resolvedConfig
    };

    let jobResult: JobResult;
    try {
      jobResult = await handler.execute(resolvedNode, context);
    } catch (err: any) {
      jobResult = { status: 'rejected', result: { error: err.message } };
    }

    // Persist job record
    try {
      const jobRepo = this.db.getRepository('jobs');
      await jobRepo.create({
        values: {
          executionId: context.executionId,
          nodeId: node.id,
          status: jobResult.status,
          result: jobResult.result ?? null,
          upstreamId: node.upstreamId ?? null,
        },
      });
    } catch {
      // Job persistence failure should not break execution
    }

    return jobResult;
  }

  /**
   * Resume a paused execution (manual approval / rejection).
   */
  async resume(executionId: string, nodeId: string, result: any): Promise<void> {
    const executionRepo = this.db.getRepository('executions');
    const execution = await executionRepo.findOne({ filter: { id: executionId } });
    if (!execution) throw new Error(`Execution "${executionId}" not found`);
    if (execution.status !== 'started') {
      throw new Error(`Execution "${executionId}" is not paused (status: ${execution.status})`);
    }

    // Update the pending job
    const jobRepo = this.db.getRepository('jobs');
    await jobRepo.update({
      filter: { executionId, nodeId, status: 'pending' },
      values: { status: result.approved ? 'resolved' : 'rejected', result },
    });

    // Fetch the workflow so we can continue
    const workflowRepo = this.db.getRepository('workflows');
    const workflow = await workflowRepo.findOne({ filter: { id: execution.workflowId } });
    if (!workflow) return;

    const nodes: WorkflowNode[] = workflow.nodes ?? [];
    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode || !result.approved) {
      await this.updateExecutionStatus(executionId, result.approved ? 'resolved' : 'rejected');
      return;
    }

    // Rebuild context from persisted job results
    const jobs = await jobRepo.find({ filter: { executionId } });
    const jobResultsMap = new Map<string, any>();
    for (const job of jobs) {
      jobResultsMap.set(job.nodeId, job.result);
    }

    const ctx = new ExecutionContext({
      executionId,
      workflowId: execution.workflowId,
      triggerData: execution.context ?? {},
      jobResults: jobResultsMap,
    });

    // Continue from the node after the manual node
    if (currentNode.downstreamId) {
      const nextNode = nodes.find((n) => n.id === currentNode.downstreamId);
      if (nextNode) {
        const finalStatus = await this.runNode(nextNode, nodes, ctx);
        await this.updateExecutionStatus(executionId, finalStatus);
        return;
      }
    }

    await this.updateExecutionStatus(executionId, 'resolved');
  }

  /**
   * Cancel a running execution.
   */
  async cancel(executionId: string): Promise<void> {
    await this.updateExecutionStatus(executionId, 'cancelled');
  }

  // ---------------------------------------------------------------------------

  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
  ): Promise<void> {
    const repo = this.db.getRepository('executions');
    await repo.update({ filter: { id: executionId }, values: { status } });
  }
}

// ─── Variable Interpolation Helpers ──────────────────────────────────────────

function resolveConfigVariables(val: any, context: ExecutionContext): any {
  if (typeof val === 'string') {
    return resolveStringValue(val, context);
  }
  if (Array.isArray(val)) {
    return val.map(item => resolveConfigVariables(item, context));
  }
  if (val && typeof val === 'object') {
    const resolved: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      resolved[key] = resolveConfigVariables(val[key], context);
    }
    return resolved;
  }
  return val;
}

function resolveStringValue(str: string, context: ExecutionContext): any {
  const regex = /\{\{([^}]+)\}\}/g;
  
  // Optimization: If the entire string is just a single placeholder, return native type
  const exactMatch = str.match(/^\{\{([^}]+)\}\}$/);
  if (exactMatch) {
    const path = exactMatch[1].trim();
    return getNestedValue(path, context);
  }
  
  return str.replace(regex, (_, path) => {
    const val = getNestedValue(path.trim(), context);
    return val !== undefined ? String(val) : '';
  });
}

function getNestedValue(path: string, context: ExecutionContext): any {
  const parts = path.split('.');
  const root = parts[0];
  const rest = parts.slice(1);

  let base: any;
  if (root === 'triggerData') {
    base = context.triggerData;
  } else if (root === 'vars' || root === 'variables') {
    return rest.reduce((acc, key) => acc?.[key], context.getVariables());
  } else {
    // Attempt to resolve as node ID or fallback to variables
    base = context.getNodeResult(root) ?? context.getVariable(root);
  }

  return rest.reduce((acc, key) => acc?.[key], base);
}


import type { ExecutionContext } from '../engine/context';

/**
 * A single node inside a workflow definition.
 */
export interface WorkflowNode {
  /** Unique identifier within the workflow. */
  id: string;
  /** Node type (matches NodeHandler.type). */
  type: string;
  /** Optional human-readable title. */
  title?: string;
  /** Node-specific configuration. */
  config: Record<string, any>;
  /** ID of the single upstream node (undefined for the first node). */
  upstreamId?: string;
  /** ID of the default downstream node. */
  downstreamId?: string;
  /**
   * For branch nodes (condition): which branch index selected the downstream
   * node — 0 = true branch, 1 = false branch.
   */
  branchIndex?: number;
}

/**
 * Result returned from a node execution.
 */
export interface JobResult {
  /** Terminal status for this node execution. */
  status: 'resolved' | 'rejected' | 'pending';
  /** Arbitrary result value forwarded to downstream nodes. */
  result?: any;
  /**
   * Explicit list of downstream node IDs to execute next.
   * When omitted the executor uses `node.downstreamId`.
   */
  nextNodes?: string[];
}

/**
 * A node handler implements the execution logic for a specific node type.
 */
export interface NodeHandler {
  readonly type: string;
  execute(node: WorkflowNode, context: ExecutionContext): Promise<JobResult>;
}

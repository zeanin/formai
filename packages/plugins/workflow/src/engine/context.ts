/**
 * Execution context passed to each node during workflow execution.
 */
export class ExecutionContext {
  readonly executionId: string;
  readonly workflowId: string;
  readonly triggerData: Record<string, any>;
  readonly jobResults: Map<string, any>;
  private _variables: Record<string, any>;

  constructor(opts: {
    executionId: string;
    workflowId: string;
    triggerData: Record<string, any>;
    jobResults?: Map<string, any>;
    variables?: Record<string, any>;
  }) {
    this.executionId = opts.executionId;
    this.workflowId = opts.workflowId;
    this.triggerData = opts.triggerData;
    this.jobResults = opts.jobResults ?? new Map();
    this._variables = opts.variables ?? {};
  }

  /** Get the result produced by a specific upstream node. */
  getNodeResult(nodeId: string): any {
    return this.jobResults.get(nodeId);
  }

  /** Set a named variable available to downstream nodes. */
  setVariable(key: string, value: any): void {
    this._variables[key] = value;
  }

  /** Get a named variable. */
  getVariable(key: string): any {
    return this._variables[key];
  }

  /** Get all variables as a plain object (for serialisation). */
  getVariables(): Record<string, any> {
    return { ...this._variables };
  }

  /** Create a child context that shares job results / variables. */
  fork(overrides: Partial<{ triggerData: Record<string, any> }>): ExecutionContext {
    return new ExecutionContext({
      executionId: this.executionId,
      workflowId: this.workflowId,
      triggerData: overrides.triggerData ?? this.triggerData,
      jobResults: this.jobResults,
      variables: this._variables,
    });
  }
}

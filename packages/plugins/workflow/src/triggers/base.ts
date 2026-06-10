/**
 * Base interface for all workflow triggers.
 */
export interface TriggerConfig {
  [key: string]: any;
}

export interface BaseTrigger {
  /** Trigger type identifier — must be unique across all registered triggers. */
  readonly type: string;

  /**
   * Called when a workflow is enabled.  The trigger should start listening for
   * events and invoke `fire` when the trigger condition is met.
   */
  register(
    workflowId: string,
    config: TriggerConfig,
    fire: (context: Record<string, any>) => Promise<void>,
  ): void;

  /**
   * Called when a workflow is disabled.  The trigger should stop listening.
   */
  unregister(workflowId: string): void;
}

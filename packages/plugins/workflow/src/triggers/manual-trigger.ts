import type { BaseTrigger, TriggerConfig } from './base';

/**
 * Manual trigger — activated via an explicit API call.
 *
 * config:
 *   inputSchema?: object  — JSON Schema describing expected input parameters
 *
 * The TriggerManager exposes `fireManual(workflowId, input)` which calls the
 * registered `fire` callback directly.  This trigger implementation stores the
 * fire callback so it can be invoked programmatically.
 */
export class ManualTrigger implements BaseTrigger {
  readonly type = 'manual';

  private fireCallbacks = new Map<string, (context: Record<string, any>) => Promise<void>>();

  register(
    workflowId: string,
    _config: TriggerConfig,
    fire: (context: Record<string, any>) => Promise<void>,
  ): void {
    this.fireCallbacks.set(workflowId, fire);
  }

  unregister(workflowId: string): void {
    this.fireCallbacks.delete(workflowId);
  }

  /**
   * Fire the manual trigger for a given workflow with an input payload.
   * Called by the TriggerManager or directly from an action handler.
   */
  async fire(workflowId: string, input: Record<string, any> = {}): Promise<void> {
    const callback = this.fireCallbacks.get(workflowId);
    if (!callback) {
      throw new Error(`No manual trigger registered for workflow "${workflowId}"`);
    }
    await callback({ triggeredAt: new Date().toISOString(), input });
  }

  /** Returns true if a manual trigger is registered for the given workflow. */
  has(workflowId: string): boolean {
    return this.fireCallbacks.has(workflowId);
  }
}

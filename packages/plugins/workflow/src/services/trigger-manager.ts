import type { BaseTrigger } from '../triggers/base';
import type { ManualTrigger } from '../triggers/manual-trigger';

/**
 * TriggerManager — maintains a registry of trigger implementations and the
 * set of currently active (enabled) workflow registrations.
 */
export class TriggerManager {
  private triggerImpls = new Map<string, BaseTrigger>();

  /** Register a trigger implementation. */
  registerTrigger(trigger: BaseTrigger): void {
    this.triggerImpls.set(trigger.type, trigger);
  }

  /** Get a trigger implementation by type. */
  getTrigger(type: string): BaseTrigger | undefined {
    return this.triggerImpls.get(type);
  }

  /** List registered trigger types. */
  list(): string[] {
    return Array.from(this.triggerImpls.keys());
  }

  /**
   * Activate a workflow's trigger.
   * @param workflowId   — unique workflow ID
   * @param triggerType  — e.g. 'collection', 'schedule', 'manual'
   * @param config       — trigger-specific config object
   * @param fire         — callback the trigger calls when it fires
   */
  register(
    workflowId: string,
    triggerType: string,
    config: Record<string, any>,
    fire: (context: Record<string, any>) => Promise<void>,
  ): void {
    const impl = this.triggerImpls.get(triggerType);
    if (!impl) {
      throw new Error(`Unknown trigger type: "${triggerType}"`);
    }
    impl.register(workflowId, config, fire);
  }

  /** Deactivate a workflow's trigger. */
  unregister(workflowId: string, triggerType: string): void {
    const impl = this.triggerImpls.get(triggerType);
    impl?.unregister(workflowId);
  }

  /**
   * Convenience: fire a manual trigger.
   * Throws if no 'manual' trigger implementation is registered.
   */
  async fireManual(workflowId: string, input: Record<string, any> = {}): Promise<void> {
    const impl = this.triggerImpls.get('manual') as ManualTrigger | undefined;
    if (!impl) throw new Error('ManualTrigger is not registered');
    await impl.fire(workflowId, input);
  }
}

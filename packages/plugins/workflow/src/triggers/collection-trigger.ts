import type { BaseTrigger, TriggerConfig } from './base';

type DatabaseEvent = 'afterCreate' | 'afterUpdate' | 'afterDestroy';

/**
 * Collection trigger — fires when a collection event occurs in the database.
 *
 * config:
 *   collection: string
 *   event:      'afterCreate' | 'afterUpdate' | 'afterDestroy'
 *   condition?: object  — optional filter; execution is skipped when not met
 */
export class CollectionTrigger implements BaseTrigger {
  readonly type = 'collection';

  /** workflowId → { collection, event, handler } */
  private registrations = new Map<
    string,
    { collection: string; event: DatabaseEvent; handler: (...args: any[]) => void }
  >();

  constructor(private db: any) {}

  register(
    workflowId: string,
    config: TriggerConfig,
    fire: (context: Record<string, any>) => Promise<void>,
  ): void {
    const { collection, event, condition } = config as {
      collection: string;
      event: DatabaseEvent;
      condition?: Record<string, any>;
    };

    if (!collection || !event) return;

    const handler = async (model: any, options: any) => {
      const record = model?.dataValues ?? model;

      // Simple condition check — all key/value pairs must match
      if (condition) {
        const passes = Object.entries(condition).every(([k, v]) => record?.[k] === v);
        if (!passes) return;
      }

      await fire({ event, collection, record, options });
    };

    this.registrations.set(workflowId, { collection, event, handler });

    // Hook into the DB event emitter
    const model = this.db.getModel?.(collection) ?? this.db.model?.(collection);
    if (model?.addHook) {
      model.addHook(event, `wf_${workflowId}`, handler);
    } else if (this.db.on) {
      this.db.on(`${collection}.${event}`, handler);
    }
  }

  unregister(workflowId: string): void {
    const reg = this.registrations.get(workflowId);
    if (!reg) return;

    const model = this.db.getModel?.(reg.collection) ?? this.db.model?.(reg.collection);
    if (model?.removeHook) {
      model.removeHook(reg.event, `wf_${workflowId}`);
    } else if (this.db.off) {
      this.db.off(`${reg.collection}.${reg.event}`, reg.handler);
    }

    this.registrations.delete(workflowId);
  }
}

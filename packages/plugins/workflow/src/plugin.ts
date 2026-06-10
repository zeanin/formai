import { Plugin } from '@formai/plugin';

// Collections
import { workflowsCollection } from './collections/workflows';
import { executionsCollection } from './collections/executions';
import { jobsCollection } from './collections/jobs';

// Engine
import { WorkflowExecutor } from './engine/executor';

// Services
import { NodeRegistry } from './services/node-registry';
import { TriggerManager } from './services/trigger-manager';

// Node handlers
import { ConditionNode } from './nodes/condition';
import { QueryNode } from './nodes/query';
import { CreateNode } from './nodes/create';
import { UpdateNode } from './nodes/update';
import { DestroyNode } from './nodes/destroy';
import { CalculationNode } from './nodes/calculation';
import { HttpRequestNode } from './nodes/http-request';
import { ManualNode } from './nodes/manual';
import { LoopNode } from './nodes/loop';
import { ParallelNode } from './nodes/parallel';

// Trigger implementations
import { CollectionTrigger } from './triggers/collection-trigger';
import { ScheduleTrigger } from './triggers/schedule-trigger';
import { ManualTrigger } from './triggers/manual-trigger';

// Actions
import { createWorkflowActions } from './actions/workflows';
import { createExecutionActions } from './actions/executions';

export default class WorkflowPlugin extends Plugin {
  executor!: WorkflowExecutor;
  triggerManager!: TriggerManager;
  nodeRegistry!: NodeRegistry;

  async load(): Promise<void> {
    // 1. Define collections
    this.defineCollection(workflowsCollection);
    this.defineCollection(executionsCollection);
    this.defineCollection(jobsCollection);

    // 2. Setup services
    this.nodeRegistry = new NodeRegistry();
    this.triggerManager = new TriggerManager();
    this.executor = new WorkflowExecutor(this.db, this.nodeRegistry);

    // 3. Register node handlers
    this.nodeRegistry.register(new ConditionNode());
    this.nodeRegistry.register(new CalculationNode());
    this.nodeRegistry.register(new HttpRequestNode());
    this.nodeRegistry.register(new ManualNode());
    this.nodeRegistry.register(new LoopNode());
    this.nodeRegistry.register(new ParallelNode());
    // DB-aware nodes receive the db reference
    this.nodeRegistry.register(new QueryNode(this.db));
    this.nodeRegistry.register(new CreateNode(this.db));
    this.nodeRegistry.register(new UpdateNode(this.db));
    this.nodeRegistry.register(new DestroyNode(this.db));

    // 4. Register trigger implementations
    this.triggerManager.registerTrigger(new CollectionTrigger(this.db));
    this.triggerManager.registerTrigger(new ScheduleTrigger());
    this.triggerManager.registerTrigger(new ManualTrigger());

    // 5. Register resource actions
    const workflowActions = createWorkflowActions(this.executor, this.triggerManager);
    const executionActions = createExecutionActions(this.executor);

    this.registerResource({
      name: 'workflows',
      actions: {
        ...workflowActions,
      },
    });

    this.registerResource({
      name: 'executions',
      actions: {
        ...executionActions,
      },
    });

    // 6. Restore enabled workflows' triggers on startup
    try {
      const repo = this.db.getRepository('workflows');
      const enabledWorkflows = await repo.find({ filter: { enabled: true } });
      for (const wf of enabledWorkflows) {
        try {
          this.triggerManager.register(
            wf.id,
            wf.triggerType,
            wf.triggerConfig ?? {},
            async (triggerCtx: Record<string, any>) => {
              await this.executor.execute(wf, triggerCtx);
            },
          );
        } catch (err: any) {
          console.warn(`[workflow] Failed to restore trigger for workflow "${wf.id}": ${err.message}`);
        }
      }
    } catch {
      // Gracefully handle if DB is not yet available during load
    }
  }

  async install(): Promise<void> {
    // No seed data needed
  }

  async destroy(): Promise<void> {
    // Clean up all registered triggers (e.g. clear setIntervals)
    try {
      const repo = this.db.getRepository('workflows');
      const enabledWorkflows = await repo.find({ filter: { enabled: true } });
      for (const wf of enabledWorkflows) {
        this.triggerManager.unregister(wf.id, wf.triggerType);
      }
    } catch {
      // ignore
    }
  }
}

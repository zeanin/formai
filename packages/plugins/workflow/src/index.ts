// Plugin
export { default as WorkflowPlugin } from './plugin';
export { default } from './plugin';

// Engine
export { WorkflowExecutor } from './engine/executor';
export type { Execution, ExecutionStatus } from './engine/executor';
export { ExecutionContext } from './engine/context';

// Services
export { NodeRegistry } from './services/node-registry';
export { TriggerManager } from './services/trigger-manager';

// Node interfaces and implementations
export type { WorkflowNode, JobResult, NodeHandler } from './nodes/base';
export { ConditionNode } from './nodes/condition';
export { QueryNode } from './nodes/query';
export { CreateNode } from './nodes/create';
export { UpdateNode } from './nodes/update';
export { DestroyNode } from './nodes/destroy';
export { CalculationNode } from './nodes/calculation';
export { HttpRequestNode } from './nodes/http-request';
export { ManualNode } from './nodes/manual';
export { LoopNode } from './nodes/loop';
export { ParallelNode } from './nodes/parallel';

// Triggers
export type { BaseTrigger, TriggerConfig } from './triggers/base';
export { CollectionTrigger } from './triggers/collection-trigger';
export { ScheduleTrigger } from './triggers/schedule-trigger';
export { ManualTrigger } from './triggers/manual-trigger';

// Collections
export { workflowsCollection } from './collections/workflows';
export { executionsCollection } from './collections/executions';
export { jobsCollection } from './collections/jobs';

// A2Flow
export { A2FlowEngine } from './a2flow/engine';
export type { GeneratedWorkflow } from './a2flow/engine';
export { WORKFLOW_SYSTEM_PROMPT, buildWorkflowPrompt } from './a2flow/prompts';

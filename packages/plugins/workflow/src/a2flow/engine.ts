import { z } from 'zod';
import type { LLMManager } from '@formai/ai';
import { WORKFLOW_SYSTEM_PROMPT, buildWorkflowPrompt } from './prompts';

// ---------------------------------------------------------------------------
// Zod schema for the generated workflow
// ---------------------------------------------------------------------------

const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  config: z.record(z.any()).default({}),
  upstreamId: z.string().optional(),
  downstreamId: z.string().optional(),
  branchIndex: z.number().optional(),
});

const WorkflowDefinitionSchema = z.object({
  title: z.string(),
  triggerType: z.enum(['manual', 'collection', 'schedule']),
  triggerConfig: z.record(z.any()).default({}),
  nodes: z.array(WorkflowNodeSchema).default([]),
});

export type GeneratedWorkflow = z.infer<typeof WorkflowDefinitionSchema>;

// ---------------------------------------------------------------------------
// A2FlowEngine — implements the skeleton from @formai/ai
// ---------------------------------------------------------------------------

export class A2FlowEngine {
  constructor(private llm: LLMManager) {}

  /**
   * Generate a workflow definition from a natural language prompt.
   *
   * @param prompt    — plain English description of the desired workflow
   * @param context   — optional extra context (e.g. available collection names)
   * @returns         — structured WorkflowDefinition
   */
  async generateWorkflow(
    prompt: string,
    context?: { collections?: string[] },
  ): Promise<GeneratedWorkflow> {
    return this.llm.generate(WorkflowDefinitionSchema, buildWorkflowPrompt(prompt, context), {
      systemPrompt: WORKFLOW_SYSTEM_PROMPT,
      maxRetries: 2,
    }) as Promise<GeneratedWorkflow>;
  }
}

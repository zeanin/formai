import type { AIAgent, AgentResult, AIMessage, ToolDefinition, TokenUsage } from '@formai/shared';
import type { LLMManager } from '../llm/manager';
import { ToolRegistry, type ToolHandler } from './tool-registry';

export interface ExecutionContext {
  user?: any;
  variables?: Record<string, any>;
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 10;

export class AgentRuntime {
  private toolRegistry: ToolRegistry;

  constructor(private llm: LLMManager) {
    this.toolRegistry = new ToolRegistry();
  }

  registerTool(name: string, definition: ToolDefinition, handler: ToolHandler): void {
    this.toolRegistry.register(name, definition, handler);
  }

  /**
   * Execute a ReAct agent loop:
   * 1. Send messages to LLM with tools
   * 2. If LLM returns tool_calls, execute them
   * 3. Feed tool results back to LLM
   * 4. Repeat until LLM returns a final answer or max iterations exceeded
   */
  async execute(
    agent: AIAgent,
    userMessage: string,
    context?: ExecutionContext,
  ): Promise<AgentResult> {
    const maxIterations = context?.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    // Collect all tool definitions: agent-defined + runtime-registered
    const agentTools = agent.tools ?? [];
    const registryTools = this.toolRegistry.getDefinitions();
    const allTools = [...agentTools, ...registryTools];

    const messages: AIMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const allToolResults: Array<{ toolCallId: string; result: any }> = [];
    const usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await this.llm.chat(messages, {
        model: agent.model,
        provider: agent.provider,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools: allTools.length > 0 ? allTools : undefined,
      });

      messages.push(response);

      // If no tool calls, we have the final answer
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          success: true,
          output: response.content,
          messages,
          toolResults: allToolResults,
          usage,
        };
      }

      // Execute all tool calls in parallel
      const toolResultMessages: AIMessage[] = await Promise.all(
        response.toolCalls.map(async (toolCall) => {
          const fnName = toolCall.function.name;
          let result: any;
          let isError = false;

          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (this.toolRegistry.has(fnName)) {
              result = await this.toolRegistry.execute(fnName, args);
            } else {
              result = { error: `Tool "${fnName}" is not available` };
              isError = true;
            }
          } catch (e) {
            result = { error: `Tool execution failed: ${(e as Error).message}` };
            isError = true;
          }

          const resultContent = typeof result === 'string' ? result : JSON.stringify(result);
          allToolResults.push({ toolCallId: toolCall.id, result });

          if (isError) {
            // log but continue
          }

          return {
            role: 'tool' as const,
            content: resultContent,
            name: fnName,
            toolCallId: toolCall.id,
          };
        }),
      );

      messages.push(...toolResultMessages);
    }

    // Max iterations exceeded - return what we have
    return {
      success: false,
      output: `Agent exceeded maximum iterations (${maxIterations})`,
      messages,
      toolResults: allToolResults,
      usage,
    };
  }
}

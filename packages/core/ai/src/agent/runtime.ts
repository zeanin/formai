import type { AIAgent, AgentResult, AIMessage, ToolDefinition, TokenUsage } from '@formai/shared';
import type { LLMManager } from '../llm/manager';
import { ToolRegistry, type ToolHandler } from './tool-registry';

export interface ExecutionContext {
  user?: any;
  variables?: Record<string, any>;
  maxIterations?: number;
  sessionId?: string; // Persistent Session ID
  parentId?: string;  // Parent trace log ID
}

const DEFAULT_MAX_ITERATIONS = 10;

export class AgentRuntime {
  private toolRegistry: ToolRegistry;

  constructor(
    private llm: LLMManager,
    private db?: any,
    private skillRegistry?: any,
  ) {
    this.toolRegistry = new ToolRegistry();
  }

  registerTool(name: string, definition: ToolDefinition, handler: ToolHandler): void {
    this.toolRegistry.register(name, definition, handler);
  }

  /**
   * Execute or resume an agent execution loop.
   * If context.sessionId is provided, it operates in persistent state mode.
   */
  async execute(
    agent: AIAgent,
    userMessage: string,
    context?: ExecutionContext,
  ): Promise<AgentResult> {
    const maxIterations = context?.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const sessionId = context?.sessionId;

    if (sessionId && this.db) {
      const sessionRepo = this.db.getRepository('agentSessions');
      const checkpointRepo = this.db.getRepository('agentCheckpoints');

      let session = await sessionRepo.findOne({ filter: { id: sessionId } });
      if (!session) {
        session = await sessionRepo.create({
          values: {
            id: sessionId,
            name: agent.name || 'AI Session',
            status: 'running',
            triggeredBy: context?.user?.id || 'anonymous',
            systemPrompt: agent.systemPrompt || '',
            initialPrompt: userMessage,
          },
        });
      } else {
        // If session exists and is paused / awaiting, resume it from checkpoint
        if (session.currentCheckpointId) {
          const checkpoint = await checkpointRepo.findOne({
            filter: { id: session.currentCheckpointId },
          });
          if (checkpoint) {
            return this.runLoop(
              sessionId,
              agent,
              checkpoint.messages,
              checkpoint.stepNumber + 1,
              context?.user || {},
              maxIterations,
            );
          }
        }
      }

      const messages: AIMessage[] = [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: userMessage },
      ];

      return this.runLoop(sessionId, agent, messages, 0, context?.user || {}, maxIterations);
    }

    // Fallback: standard in-memory ReAct loop (backwards compatible)
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

      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          success: true,
          output: response.content,
          messages,
          toolResults: allToolResults,
          usage,
        };
      }

      const toolResultMessages: AIMessage[] = await Promise.all(
        response.toolCalls.map(async (toolCall) => {
          const fnName = toolCall.function.name;
          let result: any;
          let isError = false;

          try {
            const args = JSON.parse(toolCall.function.arguments);
            if (this.toolRegistry.has(fnName)) {
              result = await this.toolRegistry.execute(fnName, args);
            } else if (this.skillRegistry?.has(fnName)) {
              const execResult = await this.skillRegistry.execute(fnName, args, context?.user || {});
              result = execResult.type === 'result' ? execResult.result : execResult.request;
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

    return {
      success: false,
      output: `Agent exceeded maximum iterations (${maxIterations})`,
      messages,
      toolResults: allToolResults,
      usage,
    };
  }

  /**
   * Resume a paused session from checkpoint.
   */
  async resume(
    sessionId: string,
    approved: boolean,
    overrideContent?: any,
  ): Promise<AgentResult> {
    const sessionRepo = this.db.getRepository('agentSessions');
    const checkpointRepo = this.db.getRepository('agentCheckpoints');
    const traceRepo = this.db.getRepository('agentTraces');

    const session = await sessionRepo.findOne({ filter: { id: sessionId } });
    if (!session || !session.currentCheckpointId) {
      throw new Error(`Session ${sessionId} has no checkpoint to resume from`);
    }

    const checkpoint = await checkpointRepo.findOne({
      filter: { id: session.currentCheckpointId },
    });
    if (!checkpoint) {
      throw new Error(`Checkpoint ${session.currentCheckpointId} not found`);
    }

    const variables = checkpoint.variables || {};
    const pendingConfirmation = variables.pendingConfirmation;
    const pendingToolCall = variables.pendingToolCall;

    if (!pendingConfirmation || !pendingToolCall) {
      throw new Error(`No pending confirmation details found in checkpoint`);
    }

    // Mark session as running
    await sessionRepo.update({
      filterByTk: sessionId,
      values: { status: 'running' },
    });

    let toolResult: any;
    if (approved) {
      try {
        if (overrideContent) {
          pendingConfirmation.args = { ...pendingConfirmation.args, ...overrideContent };
        }
        toolResult = await this.skillRegistry.confirmAndExecute(
          pendingConfirmation.confirmationId,
        );
      } catch (err: any) {
        toolResult = { error: err.message };
      }
    } else {
      toolResult = { error: 'Operation cancelled by user' };
    }

    const resultContent = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);

    // Update active trace status
    const traces = await traceRepo.find({
      filter: {
        sessionId,
        stepType: 'tool_call',
        status: 'waiting_approval',
      },
    });
    if (traces.length > 0) {
      await traceRepo.update({
        filterByTk: traces[0].id,
        values: {
          output: toolResult,
          status: approved ? 'success' : 'failed',
          errorMessage: approved ? undefined : 'Cancelled',
        },
      });
    }

    // Push tool result message
    const messages = [...checkpoint.messages];
    messages.push({
      role: 'tool' as const,
      content: resultContent,
      name: pendingToolCall.function.name,
      toolCallId: pendingToolCall.id,
    });

    const agent = {
      name: session.name,
      systemPrompt: session.systemPrompt,
      model: checkpoint.variables?.agentModel || 'gpt-4o',
      provider: checkpoint.variables?.agentProvider || 'openai',
      tools:
        this.skillRegistry?.getAvailableTools(checkpoint.variables?.skillContext || {}) || [],
    };

    return this.runLoop(
      sessionId,
      agent,
      messages,
      checkpoint.stepNumber + 1,
      checkpoint.variables?.skillContext || {},
      checkpoint.variables?.maxIterations || DEFAULT_MAX_ITERATIONS,
    );
  }

  private async runLoop(
    sessionId: string | undefined,
    agent: any,
    messages: any[],
    startStep: number,
    skillContext: any,
    maxIterations: number,
  ): Promise<AgentResult> {
    const sessionRepo = this.db?.getRepository('agentSessions');
    const checkpointRepo = this.db?.getRepository('agentCheckpoints');
    const traceRepo = this.db?.getRepository('agentTraces');

    const agentTools = agent.tools ?? [];
    const registryTools = this.toolRegistry.getDefinitions();
    const allTools = [...agentTools, ...registryTools];

    const allToolResults: any[] = [];
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let pendingConfirmation: any = null;

    for (let step = startStep; step < maxIterations; step++) {
      // Create thought/generation trace
      let stepTrace: any = null;
      if (sessionId && traceRepo) {
        stepTrace = await traceRepo.create({
          values: {
            sessionId,
            agentName: agent.name || 'Agent',
            stepType: 'thought',
            title: `LLM thought iteration ${step}`,
            input: { messagesCount: messages.length },
          },
        });
      }

      const stepStart = Date.now();
      let response: any;
      try {
        response = await this.llm.chat(messages, {
          model: agent.model,
          provider: agent.provider,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          tools: allTools.length > 0 ? allTools : undefined,
        });

        if (stepTrace && traceRepo) {
          await traceRepo.update({
            filterByTk: stepTrace.id,
            values: {
              output: response,
              durationMs: Date.now() - stepStart,
              status: 'success',
            },
          });
        }
      } catch (err: any) {
        if (stepTrace && traceRepo) {
          await traceRepo.update({
            filterByTk: stepTrace.id,
            values: {
              durationMs: Date.now() - stepStart,
              status: 'failed',
              errorMessage: err.message,
            },
          });
        }
        throw err;
      }

      messages.push(response);

      // Save checkpoint before tool run
      let checkpoint: any = null;
      if (sessionId && checkpointRepo) {
        checkpoint = await checkpointRepo.create({
          values: {
            sessionId,
            stepNumber: step,
            messages,
            variables: {
              agentModel: agent.model,
              agentProvider: agent.provider,
              skillContext,
              maxIterations,
            },
          },
        });
        await sessionRepo.update({
          filterByTk: sessionId,
          values: { currentCheckpointId: checkpoint.id },
        });
      }

      if (!response.toolCalls || response.toolCalls.length === 0) {
        if (sessionId && sessionRepo) {
          await sessionRepo.update({
            filterByTk: sessionId,
            values: { status: 'completed' },
          });
        }
        return {
          success: true,
          output: response.content,
          messages,
          toolResults: allToolResults,
          usage,
        };
      }

      const toolResultMessages: any[] = [];
      for (const toolCall of response.toolCalls) {
        const fnName = toolCall.function.name;
        let result: any;
        let requiresPause = false;

        // Trace start
        let toolTrace: any = null;
        if (sessionId && traceRepo) {
          toolTrace = await traceRepo.create({
            values: {
              sessionId,
              agentName: agent.name || 'Agent',
              stepType: 'tool_call',
              title: `Execute tool: ${fnName}`,
              input: { arguments: toolCall.function.arguments },
            },
          });
        }
        const toolStart = Date.now();

        try {
          const args = JSON.parse(toolCall.function.arguments);

          if (this.skillRegistry?.has(fnName)) {
            const execResult = await this.skillRegistry.execute(fnName, args, skillContext);
            if (execResult.type === 'confirmation') {
              requiresPause = true;
              pendingConfirmation = execResult.request;
              result = {
                status: 'awaiting_confirmation',
                message: `Action "${execResult.request.skillTitle}" requires confirmation`,
                confirmationId: execResult.request.confirmationId,
              };
            } else {
              result = execResult.result;
            }
          } else if (this.toolRegistry.has(fnName)) {
            result = await this.toolRegistry.execute(fnName, args);
          } else {
            result = { error: `Tool "${fnName}" not found` };
          }
        } catch (e: any) {
          result = { error: e.message };
        }

        // Trace finish
        if (toolTrace && traceRepo) {
          await traceRepo.update({
            filterByTk: toolTrace.id,
            values: {
              output: result,
              durationMs: Date.now() - toolStart,
              status: requiresPause ? 'waiting_approval' : 'success',
            },
          });
        }

        const resultContent = typeof result === 'string' ? result : JSON.stringify(result);
        toolResultMessages.push({
          role: 'tool' as const,
          content: resultContent,
          name: fnName,
          toolCallId: toolCall.id,
        });

        if (requiresPause) {
          // Update checkpoint with pending details
          if (sessionId && checkpointRepo && checkpoint) {
            messages.push(...toolResultMessages);
            await checkpointRepo.update({
              filterByTk: checkpoint.id,
              values: {
                messages,
                variables: {
                  agentModel: agent.model,
                  agentProvider: agent.provider,
                  skillContext,
                  maxIterations,
                  pendingConfirmation,
                  pendingToolCall: toolCall,
                },
              },
            });
            await sessionRepo.update({
              filterByTk: sessionId,
              values: {
                status: 'waiting_approval',
                currentCheckpointId: checkpoint.id,
              },
            });
          }
          return {
            success: true,
            output: 'Paused for confirmation',
            messages,
            toolResults: allToolResults,
            pendingConfirmation,
            usage,
          };
        }

        allToolResults.push({ toolCallId: toolCall.id, result });
      }

      messages.push(...toolResultMessages);
    }

    if (sessionId && sessionRepo) {
      await sessionRepo.update({
        filterByTk: sessionId,
        values: { status: 'failed' },
      });
    }

    return {
      success: false,
      output: `Agent exceeded maximum iterations (${maxIterations})`,
      messages,
      toolResults: allToolResults,
      usage,
    };
  }
}


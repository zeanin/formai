import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRuntime } from '../agent/runtime';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';
import type { AIAgent, AIMessage, ToolCall } from '@formai/shared';

const TEST_AGENT: AIAgent = {
  id: 'test-agent',
  name: 'Test Agent',
  description: 'An agent for testing',
  systemPrompt: 'You are a helpful test assistant.',
  model: 'mock-1',
  provider: 'mock',
  tools: [],
};

describe('AgentRuntime', () => {
  let manager: LLMManager;
  let mock: MockLLMProvider;
  let runtime: AgentRuntime;

  beforeEach(() => {
    manager = new LLMManager();
    mock = new MockLLMProvider();
    manager.registerProvider(mock);
    runtime = new AgentRuntime(manager);
  });

  // ---- Basic execution ----

  describe('execute - basic', () => {
    it('returns success when LLM gives direct answer', async () => {
      mock.setResponses([{ role: 'assistant', content: 'The answer is 42.' }]);

      const result = await runtime.execute(TEST_AGENT, 'What is the answer?');
      expect(result.success).toBe(true);
      expect(result.output).toBe('The answer is 42.');
    });

    it('includes all messages in result', async () => {
      mock.setResponses([{ role: 'assistant', content: 'Done.' }]);

      const result = await runtime.execute(TEST_AGENT, 'Hello');
      // system + user + assistant
      expect(result.messages.length).toBeGreaterThanOrEqual(3);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[1].content).toBe('Hello');
    });
  });

  // ---- Tool execution ----

  describe('execute - tool calls', () => {
    it('executes a registered tool and feeds result back to LLM', async () => {
      // First response: request tool call
      const toolCallResponse: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'get_weather', arguments: '{"city": "Tokyo"}' },
          },
        ] as ToolCall[],
      };
      // Second response: final answer after tool result
      const finalResponse: AIMessage = {
        role: 'assistant',
        content: 'The weather in Tokyo is sunny.',
      };

      mock.setResponses([toolCallResponse, finalResponse]);

      runtime.registerTool(
        'get_weather',
        {
          name: 'get_weather',
          description: 'Get weather for a city',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
        async (args: { city: string }) => ({ temperature: 25, condition: 'sunny', city: args.city }),
      );

      const result = await runtime.execute(TEST_AGENT, 'What is the weather in Tokyo?');
      expect(result.success).toBe(true);
      expect(result.output).toBe('The weather in Tokyo is sunny.');
      expect(result.toolResults).toHaveLength(1);
      expect(result.toolResults![0].toolCallId).toBe('call_1');
      expect(result.toolResults![0].result.city).toBe('Tokyo');
    });

    it('handles unknown tool gracefully', async () => {
      const toolCallResponse: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_bad',
            type: 'function',
            function: { name: 'nonexistent_tool', arguments: '{}' },
          },
        ] as ToolCall[],
      };
      const finalResponse: AIMessage = {
        role: 'assistant',
        content: 'Sorry, could not execute the tool.',
      };

      mock.setResponses([toolCallResponse, finalResponse]);

      const result = await runtime.execute(TEST_AGENT, 'Use nonexistent tool');
      // Should still complete, just with error in tool result
      expect(result.success).toBe(true);
      expect(result.toolResults![0].result.error).toContain('nonexistent_tool');
    });

    it('handles tool execution error gracefully', async () => {
      const toolCallResponse: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_err',
            type: 'function',
            function: { name: 'failing_tool', arguments: '{}' },
          },
        ] as ToolCall[],
      };
      mock.setResponses([toolCallResponse, { role: 'assistant', content: 'Tool failed.' }]);

      runtime.registerTool(
        'failing_tool',
        { name: 'failing_tool', description: 'A tool that always fails', parameters: {} },
        async () => { throw new Error('Intentional failure'); },
      );

      const result = await runtime.execute(TEST_AGENT, 'Call failing tool');
      expect(result.toolResults![0].result.error).toContain('Intentional failure');
    });
  });

  // ---- Max iterations ----

  describe('execute - max iterations', () => {
    it('stops after max iterations and returns failure', async () => {
      // Always return tool calls to force the loop
      const toolCallResponse = (): AIMessage => ({
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: `call_${Math.random()}`,
            type: 'function',
            function: { name: 'looping_tool', arguments: '{}' },
          },
        ] as ToolCall[],
      });

      // Return many tool call responses
      mock.setResponses(Array.from({ length: 20 }, toolCallResponse));

      runtime.registerTool(
        'looping_tool',
        { name: 'looping_tool', description: 'A tool that keeps getting called', parameters: {} },
        async () => 'still going',
      );

      const result = await runtime.execute(TEST_AGENT, 'Loop forever', { maxIterations: 3 });
      expect(result.success).toBe(false);
      expect(result.output).toContain('3');
    });
  });

  // ---- registerTool ----

  describe('registerTool', () => {
    it('registers a tool that can be called during execution', async () => {
      let called = false;
      runtime.registerTool(
        'ping',
        { name: 'ping', description: 'Ping tool', parameters: {} },
        async () => { called = true; return 'pong'; },
      );

      const toolCallResponse: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'ping', arguments: '{}' } }] as ToolCall[],
      };
      mock.setResponses([toolCallResponse, { role: 'assistant', content: 'pong received' }]);

      await runtime.execute(TEST_AGENT, 'ping');
      expect(called).toBe(true);
    });
  });
});

import type { AIMessage, AIMessageChunk, ChatOptions, EmbeddingResult, ToolCall } from '@formai/shared';
import { BaseLLMProvider } from '../provider';

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

function toAnthropicMessages(messages: AIMessage[]): Array<{ role: string; content: any }> {
  const result: Array<{ role: string; content: any }> = [];
  for (const m of messages) {
    if (m.role === 'system') continue; // handled separately
    if (m.role === 'tool') {
      result.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: m.content,
          },
        ],
      });
    } else if (m.toolCalls && m.toolCalls.length > 0) {
      result.push({
        role: 'assistant',
        content: m.toolCalls.map((tc) => ({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        })),
      });
    } else {
      result.push({ role: m.role, content: m.content });
    }
  }
  return result;
}

function fromAnthropicResponse(data: any): AIMessage {
  const content = data.content as any[];
  const textParts = content.filter((c) => c.type === 'text');
  const toolUseParts = content.filter((c) => c.type === 'tool_use');

  const result: AIMessage = {
    role: 'assistant',
    content: textParts.map((t) => t.text).join('') ?? '',
  };

  if (toolUseParts.length > 0) {
    result.toolCalls = toolUseParts.map((t) => ({
      id: t.id,
      type: 'function' as const,
      function: {
        name: t.name,
        arguments: JSON.stringify(t.input),
      },
    })) as ToolCall[];
  }

  return result;
}

export class AnthropicProvider extends BaseLLMProvider {
  name = 'anthropic';
  supportsStreaming = true;
  maxTokens = 200000;
  defaultModel: string;

  constructor(private config: AnthropicConfig) {
    super();
    this.defaultModel = config.model ?? 'claude-sonnet-4-20250514';
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<AIMessage> {
    const baseURL = this.config.baseURL ?? 'https://api.anthropic.com';
    const url = `${baseURL}/v1/messages`;

    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n') || undefined;

    const body: Record<string, any> = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: toAnthropicMessages(messages),
    };
    if (systemPrompt) body.system = systemPrompt;
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.stop) body.stop_sequences = options.stop;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    return fromAnthropicResponse(data);
  }

  async *chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk> {
    const baseURL = this.config.baseURL ?? 'https://api.anthropic.com';
    const url = `${baseURL}/v1/messages`;

    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n') || undefined;

    const body: Record<string, any> = {
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: toAnthropicMessages(messages),
      stream: true,
    };
    if (systemPrompt) body.system = systemPrompt;
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${text}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr) as any;
            if (event.type === 'content_block_delta') {
              const delta = event.delta;
              if (delta.type === 'text_delta') {
                yield { content: delta.text };
              }
            } else if (event.type === 'message_delta') {
              if (event.delta?.stop_reason) {
                const finishMap: Record<string, AIMessageChunk['finishReason']> = {
                  end_turn: 'stop',
                  max_tokens: 'length',
                  tool_use: 'tool_calls',
                };
                yield { finishReason: finishMap[event.delta.stop_reason] ?? 'stop' };
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

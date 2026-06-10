import type { AIMessage, AIMessageChunk, ChatOptions, EmbeddingResult, ToolCall } from '@formai/shared';
import { BaseLLMProvider } from '../provider';

export interface OpenAIConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  organization?: string;
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function toOpenAIMessages(messages: AIMessage[]): OpenAIMessage[] {
  return messages.map((m) => {
    const msg: OpenAIMessage = {
      role: m.role === 'tool' ? 'tool' : m.role,
      content: m.content,
    };
    if (m.name) msg.name = m.name;
    if (m.toolCallId) msg.tool_call_id = m.toolCallId;
    if (m.toolCalls && m.toolCalls.length > 0) {
      msg.tool_calls = m.toolCalls;
    }
    return msg;
  });
}

function fromOpenAIMessage(choice: any): AIMessage {
  const msg = choice.message;
  const result: AIMessage = {
    role: msg.role,
    content: msg.content ?? '',
  };
  if (msg.tool_calls) {
    result.toolCalls = msg.tool_calls as ToolCall[];
  }
  return result;
}

function buildURL(baseURL: string, path: string): string {
  const cleanBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
  if (cleanBase.endsWith('/v1')) {
    return `${cleanBase}${path}`;
  }
  return `${cleanBase}/v1${path}`;
}

export class OpenAIProvider extends BaseLLMProvider {
  name = 'openai';
  supportsStreaming = true;
  maxTokens = 128000;
  defaultModel: string;

  constructor(private config: OpenAIConfig) {
    super();
    this.defaultModel = config.model ?? 'gpt-4o';
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<AIMessage> {
    const baseURL = this.config.baseURL ?? 'https://api.openai.com';
    const url = buildURL(baseURL, '/chat/completions');

    const body: Record<string, any> = {
      model: options?.model ?? this.defaultModel,
      messages: toOpenAIMessages(messages),
    };
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
    if (options?.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
    if (options?.stop) body.stop = options.stop;
    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    return fromOpenAIMessage(data.choices[0]);
  }

  async *chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk> {
    const baseURL = this.config.baseURL ?? 'https://api.openai.com';
    const url = buildURL(baseURL, '/chat/completions');

    const body: Record<string, any> = {
      model: options?.model ?? this.defaultModel,
      messages: toOpenAIMessages(messages),
      stream: true,
    };
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    };
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text}`);
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
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr) as any;
            const delta = chunk.choices?.[0]?.delta;
            if (!delta) continue;
            const out: AIMessageChunk = {};
            if (delta.role) out.role = delta.role;
            if (delta.content != null) out.content = delta.content;
            if (delta.tool_calls) out.toolCalls = delta.tool_calls;
            const finishReason = chunk.choices?.[0]?.finish_reason;
            if (finishReason) out.finishReason = finishReason;
            yield out;
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    const baseURL = this.config.baseURL ?? 'https://api.openai.com';
    const url = buildURL(baseURL, '/embeddings');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI embeddings error ${response.status}: ${text}`);
    }

    const data = await response.json() as any;
    return {
      embeddings: data.data.map((d: any) => d.embedding as number[]),
      usage: { totalTokens: data.usage?.total_tokens ?? 0 },
    };
  }
}

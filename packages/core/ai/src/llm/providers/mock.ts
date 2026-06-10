import type { AIMessage, AIMessageChunk, ChatOptions, EmbeddingResult } from '@formai/shared';
import { BaseLLMProvider } from '../provider';

export class MockLLMProvider extends BaseLLMProvider {
  name = 'mock';
  supportsStreaming = true;
  maxTokens = 4096;
  defaultModel = 'mock-1';

  private responses: AIMessage[] = [];

  setResponses(responses: AIMessage[]): void {
    this.responses = [...responses];
  }

  async chat(_messages: AIMessage[], _options?: ChatOptions): Promise<AIMessage> {
    if (this.responses.length > 0) {
      return this.responses.shift()!;
    }
    // Default echo response
    const last = _messages[_messages.length - 1];
    return {
      role: 'assistant',
      content: `Echo: ${last?.content ?? ''}`,
    };
  }

  async *chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk> {
    const response = await this.chat(messages, options);
    // Emit content word by word to simulate streaming
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      yield {
        role: i === 0 ? 'assistant' : undefined,
        content: i === 0 ? words[i] : ` ${words[i]}`,
        finishReason: isLast ? 'stop' : undefined,
      };
    }
    if (response.toolCalls) {
      yield { toolCalls: response.toolCalls, finishReason: 'tool_calls' };
    }
  }

  async embed(texts: string[]): Promise<EmbeddingResult> {
    // Return deterministic mock embeddings (1536 dims)
    return {
      embeddings: texts.map((t) => {
        const dims = 1536;
        const arr = new Array<number>(dims).fill(0);
        for (let i = 0; i < Math.min(t.length, dims); i++) {
          arr[i] = t.charCodeAt(i) / 256;
        }
        return arr;
      }),
      usage: { totalTokens: texts.reduce((acc, t) => acc + t.split(' ').length, 0) },
    };
  }
}

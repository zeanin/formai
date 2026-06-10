import type { AIMessage, AIMessageChunk, ChatOptions, EmbeddingResult } from '@formai/shared';

export interface LLMProvider {
  name: string;
  supportsStreaming: boolean;
  maxTokens: number;
  defaultModel: string;

  chat(messages: AIMessage[], options?: ChatOptions): Promise<AIMessage>;
  chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk>;
  embed(texts: string[]): Promise<EmbeddingResult>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;
  abstract supportsStreaming: boolean;
  abstract maxTokens: number;
  abstract defaultModel: string;

  abstract chat(messages: AIMessage[], options?: ChatOptions): Promise<AIMessage>;
  abstract chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk>;

  async embed(_texts: string[]): Promise<EmbeddingResult> {
    throw new Error(`Provider ${this.name} does not support embeddings`);
  }
}

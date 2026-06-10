import type { AIMessage, AIMessageChunk, ChatOptions } from '@formai/shared';
import { z } from 'zod';
import type { LLMProvider } from './provider';
import { generateStructured } from './structured-output';

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string | null = null;

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    if (this.defaultProvider === null) {
      this.defaultProvider = provider.name;
    }
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" is not registered`);
    }
    this.defaultProvider = name;
  }

  getProvider(name?: string): LLMProvider {
    const key = name ?? this.defaultProvider;
    if (!key) {
      throw new Error('No LLM provider registered');
    }
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(`Provider "${key}" not found`);
    }
    return provider;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<AIMessage> {
    const provider = this.getProvider(options?.provider);
    return provider.chat(messages, options);
  }

  async *chatStream(messages: AIMessage[], options?: ChatOptions): AsyncIterable<AIMessageChunk> {
    const provider = this.getProvider(options?.provider);
    yield* provider.chatStream(messages, options);
  }

  async generate<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    options?: ChatOptions & { systemPrompt?: string; maxRetries?: number },
  ): Promise<T> {
    return generateStructured(this, schema, prompt, options);
  }

  async embed(texts: string[], providerName?: string): Promise<number[][]> {
    const provider = this.getProvider(providerName);
    const result = await provider.embed(texts);
    return result.embeddings;
  }
}

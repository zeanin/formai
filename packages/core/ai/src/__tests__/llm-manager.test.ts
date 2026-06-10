import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';
import type { AIMessage } from '@formai/shared';

describe('LLMManager', () => {
  let manager: LLMManager;
  let mock: MockLLMProvider;

  beforeEach(() => {
    manager = new LLMManager();
    mock = new MockLLMProvider();
    manager.registerProvider(mock);
  });

  // ---- Provider registration ----

  describe('registerProvider / listProviders', () => {
    it('registers a provider and lists it', () => {
      expect(manager.listProviders()).toContain('mock');
    });

    it('sets first registered provider as default', () => {
      const provider = manager.getProvider();
      expect(provider.name).toBe('mock');
    });

    it('registers multiple providers', () => {
      const mock2 = new MockLLMProvider();
      mock2.name = 'mock2';
      manager.registerProvider(mock2);
      expect(manager.listProviders()).toEqual(['mock', 'mock2']);
    });
  });

  describe('setDefaultProvider', () => {
    it('changes the default provider', () => {
      const mock2 = new MockLLMProvider();
      mock2.name = 'mock2';
      manager.registerProvider(mock2);
      manager.setDefaultProvider('mock2');
      expect(manager.getProvider().name).toBe('mock2');
    });

    it('throws if provider not registered', () => {
      expect(() => manager.setDefaultProvider('nonexistent')).toThrow();
    });
  });

  describe('getProvider', () => {
    it('returns provider by name', () => {
      expect(manager.getProvider('mock').name).toBe('mock');
    });

    it('throws if no provider registered and none specified', () => {
      const emptyManager = new LLMManager();
      expect(() => emptyManager.getProvider()).toThrow('No LLM provider registered');
    });

    it('throws if named provider not found', () => {
      expect(() => manager.getProvider('nonexistent')).toThrow('not found');
    });
  });

  // ---- chat ----

  describe('chat', () => {
    it('returns echo response by default', async () => {
      const response = await manager.chat([{ role: 'user', content: 'Hello' }]);
      expect(response.role).toBe('assistant');
      expect(response.content).toContain('Hello');
    });

    it('returns queued responses in order', async () => {
      mock.setResponses([
        { role: 'assistant', content: 'First' },
        { role: 'assistant', content: 'Second' },
      ]);
      const r1 = await manager.chat([{ role: 'user', content: 'msg1' }]);
      const r2 = await manager.chat([{ role: 'user', content: 'msg2' }]);
      expect(r1.content).toBe('First');
      expect(r2.content).toBe('Second');
    });

    it('falls back to echo after responses are exhausted', async () => {
      mock.setResponses([{ role: 'assistant', content: 'Only' }]);
      await manager.chat([{ role: 'user', content: 'first' }]);
      const r2 = await manager.chat([{ role: 'user', content: 'fallback test' }]);
      expect(r2.content).toContain('fallback test');
    });
  });

  // ---- chatStream ----

  describe('chatStream', () => {
    it('streams content in chunks', async () => {
      const chunks: string[] = [];
      for await (const chunk of manager.chatStream([{ role: 'user', content: 'hello world' }])) {
        if (chunk.content) chunks.push(chunk.content);
      }
      expect(chunks.join('')).toContain('hello');
    });

    it('includes role in first chunk', async () => {
      const firstChunk = (await manager.chatStream([{ role: 'user', content: 'test' }])[Symbol.asyncIterator]().next()).value;
      expect(firstChunk?.role).toBe('assistant');
    });
  });

  // ---- generate (structured output) ----

  describe('generate', () => {
    it('returns parsed structured output matching the schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mock.setResponses([
        { role: 'assistant', content: '{"name": "Alice", "age": 30}' },
      ]);

      const result = await manager.generate(schema, 'Generate a person');
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
    });

    it('retries on invalid JSON', async () => {
      const schema = z.object({ value: z.string() });

      mock.setResponses([
        { role: 'assistant', content: 'not json' },
        { role: 'assistant', content: '{"value": "recovered"}' },
      ]);

      const result = await manager.generate(schema, 'test', { maxRetries: 3 });
      expect(result.value).toBe('recovered');
    });

    it('retries on schema validation failure', async () => {
      const schema = z.object({ count: z.number() });

      mock.setResponses([
        { role: 'assistant', content: '{"count": "not-a-number"}' },
        { role: 'assistant', content: '{"count": 42}' },
      ]);

      const result = await manager.generate(schema, 'test', { maxRetries: 3 });
      expect(result.count).toBe(42);
    });

    it('throws after max retries exceeded', async () => {
      const schema = z.object({ value: z.number() });
      // All responses are invalid
      mock.setResponses([
        { role: 'assistant', content: 'bad' },
        { role: 'assistant', content: 'bad' },
        { role: 'assistant', content: 'bad' },
      ]);

      await expect(manager.generate(schema, 'test', { maxRetries: 3 })).rejects.toThrow();
    });
  });

  // ---- embed ----

  describe('embed', () => {
    it('returns embeddings array', async () => {
      const embeddings = await manager.embed(['hello', 'world']);
      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(1536);
      expect(typeof embeddings[0][0]).toBe('number');
    });

    it('returns different embeddings for different texts', async () => {
      const embeddings = await manager.embed(['hello', 'world']);
      expect(embeddings[0]).not.toEqual(embeddings[1]);
    });
  });
});

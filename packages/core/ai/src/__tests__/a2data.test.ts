import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { A2DataEngine } from '../a2data/engine';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';

describe('A2DataEngine', () => {
  let manager: LLMManager;
  let mock: MockLLMProvider;
  let engine: A2DataEngine;

  beforeEach(() => {
    manager = new LLMManager();
    mock = new MockLLMProvider();
    manager.registerProvider(mock);
    engine = new A2DataEngine(manager);
  });

  // ---- generateCollection ----

  describe('generateCollection', () => {
    it('generates a collection definition from a natural language prompt', async () => {
      const collectionDef = {
        name: 'products',
        title: 'Products',
        fields: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'name', type: 'string', allowNull: false },
          { name: 'price', type: 'float', allowNull: false },
          { name: 'description', type: 'text', allowNull: true },
          { name: 'stock_quantity', type: 'integer', defaultValue: 0 },
        ],
        timestamps: true,
      };

      mock.setResponses([{ role: 'assistant', content: JSON.stringify(collectionDef) }]);

      const result = await engine.generateCollection('Create a product catalog');
      expect(result.name).toBe('products');
      expect(result.fields).toHaveLength(5);
      expect(result.fields.find((f) => f.name === 'id')).toBeDefined();
    });

    it('passes existing collections context in prompt', async () => {
      let capturedMessages: any[] = [];
      const originalChat = mock.chat.bind(mock);
      mock.chat = async (messages: any[], options?: any) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify({
          name: 'orders',
          fields: [
            { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
            { name: 'user_id', type: 'belongsTo', target: 'users' },
          ],
        })};
      };

      await engine.generateCollection('Create an orders table', {
        existingCollections: ['users', 'products'],
      });

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('users');
      expect(userMessage?.content).toContain('products');
    });

    it('returns a valid CollectionOptions object', async () => {
      const validCollection = {
        name: 'blog_posts',
        title: 'Blog Posts',
        fields: [
          { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
          { name: 'title', type: 'string', allowNull: false },
          { name: 'content', type: 'text' },
          { name: 'published', type: 'boolean', defaultValue: false },
          { name: 'published_at', type: 'datetime', allowNull: true },
        ],
        timestamps: true,
        paranoid: false,
      };

      mock.setResponses([{ role: 'assistant', content: JSON.stringify(validCollection) }]);

      const result = await engine.generateCollection('Blog posts collection');
      expect(result.name).toBe('blog_posts');
      expect(typeof result.name).toBe('string');
      expect(Array.isArray(result.fields)).toBe(true);
    });
  });

  // ---- suggestFields ----

  describe('suggestFields', () => {
    it('suggests fields for a collection name', async () => {
      const fieldDef = {
        fields: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'username', type: 'string', unique: true },
          { name: 'email', type: 'string', unique: true },
          { name: 'password_hash', type: 'string' },
          { name: 'created_at', type: 'datetime' },
        ],
      };

      mock.setResponses([{ role: 'assistant', content: JSON.stringify(fieldDef) }]);

      const fields = await engine.suggestFields('users');
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields[0]).toHaveProperty('name');
      expect(fields[0]).toHaveProperty('type');
    });

    it('includes description in prompt when provided', async () => {
      let capturedMessages: any[] = [];
      mock.chat = async (messages: any[]) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify({ fields: [] }) };
      };

      await engine.suggestFields('inventory', 'Track product stock levels and warehouse locations');

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('inventory');
      expect(userMessage?.content).toContain('stock levels');
    });
  });

  // ---- suggestRelations ----

  describe('suggestRelations', () => {
    it('suggests relations between collections', async () => {
      const relationsDef = {
        relations: [
          {
            from: 'orders',
            to: 'users',
            type: 'belongsTo',
            field: { name: 'user_id', type: 'belongsTo', target: 'users', foreignKey: 'user_id' },
          },
          {
            from: 'orders',
            to: 'products',
            type: 'belongsToMany',
            field: { name: 'products', type: 'belongsToMany', target: 'products', through: 'order_products' },
          },
        ],
      };

      mock.setResponses([{ role: 'assistant', content: JSON.stringify(relationsDef) }]);

      const relations = await engine.suggestRelations(['users', 'orders', 'products']);
      expect(Array.isArray(relations)).toBe(true);
      expect(relations.length).toBe(2);
      expect(relations[0]).toHaveProperty('from');
      expect(relations[0]).toHaveProperty('to');
      expect(relations[0]).toHaveProperty('type');
      expect(relations[0]).toHaveProperty('field');
    });

    it('passes collection names in prompt', async () => {
      let capturedMessages: any[] = [];
      mock.chat = async (messages: any[]) => {
        capturedMessages = messages;
        return { role: 'assistant' as const, content: JSON.stringify({ relations: [] }) };
      };

      await engine.suggestRelations(['users', 'invoices', 'payments']);

      const userMessage = capturedMessages.find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('users');
      expect(userMessage?.content).toContain('invoices');
      expect(userMessage?.content).toContain('payments');
    });
  });
});

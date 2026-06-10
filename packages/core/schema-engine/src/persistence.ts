import { ISchema } from '@formai/shared';

export interface SchemaPersistence {
  save(uid: string, schema: ISchema): Promise<void>;
  load(uid: string): Promise<ISchema | null>;
  remove(uid: string): Promise<void>;
  list(): Promise<Array<{ uid: string; title?: string; updatedAt: string }>>;
}

interface StoreEntry {
  schema: ISchema;
  updatedAt: string;
}

/**
 * In-memory schema persistence implementation.
 * Suitable for development, testing, and prototype scenarios.
 */
export class MemorySchemaPersistence implements SchemaPersistence {
  private store: Map<string, StoreEntry> = new Map();

  async save(uid: string, schema: ISchema): Promise<void> {
    this.store.set(uid, {
      schema,
      updatedAt: new Date().toISOString(),
    });
  }

  async load(uid: string): Promise<ISchema | null> {
    const entry = this.store.get(uid);
    return entry ? entry.schema : null;
  }

  async remove(uid: string): Promise<void> {
    this.store.delete(uid);
  }

  async list(): Promise<Array<{ uid: string; title?: string; updatedAt: string }>> {
    const result: Array<{ uid: string; title?: string; updatedAt: string }> = [];
    for (const [uid, entry] of this.store.entries()) {
      result.push({
        uid,
        title: entry.schema.title,
        updatedAt: entry.updatedAt,
      });
    }
    // Return sorted by updatedAt descending (most recent first)
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

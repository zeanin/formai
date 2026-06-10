import { randomUUID } from 'crypto';

export interface VectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

interface VectorMemoryOptions {
  tableName?: string;
  dimensions?: number;
}

/**
 * pgvector-based vector storage for semantic memory.
 * Requires the pgvector extension installed in PostgreSQL.
 */
export class VectorMemory {
  private tableName: string;
  private dimensions: number;

  constructor(
    private db: any,
    options?: VectorMemoryOptions,
  ) {
    this.tableName = options?.tableName ?? 'ai_vector_memory';
    this.dimensions = options?.dimensions ?? 1536;
  }

  /**
   * Initialize the pgvector extension and create the memory table.
   */
  async initialize(): Promise<void> {
    await this.db.sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await this.db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        embedding vector(${this.dimensions}),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.db.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx
        ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    `);
  }

  /**
   * Store a content string with its embedding vector.
   */
  async store(
    content: string,
    embedding: number[],
    metadata?: Record<string, any>,
  ): Promise<string> {
    const id = randomUUID();
    const embeddingStr = `[${embedding.join(',')}]`;
    await this.db.sequelize.query(
      `INSERT INTO ${this.tableName} (id, content, embedding, metadata)
       VALUES (:id, :content, :embedding::vector, :metadata::jsonb)`,
      {
        replacements: {
          id,
          content,
          embedding: embeddingStr,
          metadata: JSON.stringify(metadata ?? {}),
        },
      },
    );
    return id;
  }

  /**
   * Search for the most similar vectors using cosine similarity.
   */
  async search(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: Record<string, any>,
  ): Promise<VectorSearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let whereClause = '';
    const replacements: Record<string, any> = { embedding: embeddingStr, topK };

    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(([key, value], i) => {
        replacements[`filter_key_${i}`] = key;
        replacements[`filter_val_${i}`] = JSON.stringify(value);
        return `metadata->>'${key}' = :filter_val_${i}`;
      });
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const [rows] = await this.db.sequelize.query(
      `SELECT id, content, metadata,
              1 - (embedding <=> :embedding::vector) AS similarity
       FROM ${this.tableName}
       ${whereClause}
       ORDER BY embedding <=> :embedding::vector
       LIMIT :topK`,
      { replacements },
    );

    return (rows as any[]).map((row) => ({
      id: row.id as string,
      content: row.content as string,
      metadata: (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) as Record<string, any>,
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Delete a stored vector by ID.
   */
  async delete(id: string): Promise<void> {
    await this.db.sequelize.query(
      `DELETE FROM ${this.tableName} WHERE id = :id`,
      { replacements: { id } },
    );
  }

  /**
   * Clear all stored vectors.
   */
  async clear(): Promise<void> {
    await this.db.sequelize.query(`DELETE FROM ${this.tableName}`);
  }
}

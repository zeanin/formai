import { Sequelize, Options as SequelizeOptions } from 'sequelize';
import { EventEmitter } from 'events';
import { CollectionOptions } from '@formai/shared';
import { Collection } from './collection';
import { Repository } from './repository';
import { defineMetaCollections } from './meta-schema';
import { MigrationManager, Migration } from './migration';
import { coreMigrations } from './migrations';

export interface DatabaseOptions {
  dialect: 'postgres';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  logging?: boolean | ((sql: string) => void);
  pool?: {
    max?: number;
    min?: number;
    idle?: number;
  };
}

export class Database extends EventEmitter {
  sequelize: Sequelize;
  migrationManager: MigrationManager;
  private collections: Map<string, Collection> = new Map();

  constructor(options: DatabaseOptions) {
    super();

    const seqOptions: SequelizeOptions = {
      dialect: options.dialect,
      host: options.host ?? 'localhost',
      port: options.port ?? 5432,
      username: options.username ?? 'postgres',
      password: options.password ?? '',
      database: options.database ?? 'postgres',
      logging: options.logging === true
        ? (sql: string) => console.log('[SQL]', sql)
        : options.logging === false
          ? false
          : options.logging,
      pool: {
        max: options.pool?.max ?? 5,
        min: options.pool?.min ?? 0,
        idle: options.pool?.idle ?? 10000,
      },
    };

    this.sequelize = new Sequelize(seqOptions);
    this.migrationManager = new MigrationManager(this, {
      migrations: coreMigrations,
    });
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Authenticate the connection and sync meta-tables.
   */
  async connect(): Promise<void> {
    await this.sequelize.authenticate();
    this.emit('connected');

    // Ensure meta tables exist
    const { CollectionModel, FieldModel } = defineMetaCollections(
      this.sequelize,
    );
    // Use force:false, alter:false to avoid Sequelize generating broken ALTER
    // statements for columns with unique constraints on already-existing tables.
    await CollectionModel.sync({ force: false });
    await FieldModel.sync({ force: false });

    this.emit('ready');
  }

  async disconnect(): Promise<void> {
    await this.sequelize.close();
    this.emit('disconnected');
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Collection management
  // ---------------------------------------------------------------------------

  /**
   * Define (or redefine) a collection.  Synchronous — does NOT touch the DB.
   */
  collection(options: CollectionOptions): Collection {
    const existing = this.collections.get(options.name);
    if (existing) {
      // Re-define: remove then recreate
      this.removeCollection(options.name);
    } else {
      // Also clean up any pre-existing raw Sequelize model of the same name
      // (e.g. registered by defineMetaCollections before this collection object was created)
      const name = options.name;
      const seq = this.sequelize as any;
      if (seq.models[name]) {
        delete seq.models[name];
      }
      if (seq.modelManager?.models) {
        const idx = seq.modelManager.models.findIndex((m: any) => m.name === name);
        if (idx > -1) {
          seq.modelManager.models.splice(idx, 1);
        }
      }
    }

    const col = new Collection(options, this);
    this.collections.set(options.name, col);
    this.emit('collection.define', col);
    return col;
  }

  getCollection(name: string): Collection | undefined {
    return this.collections.get(name);
  }

  hasCollection(name: string): boolean {
    return this.collections.has(name);
  }

  removeCollection(name: string): void {
    const col = this.collections.get(name);
    if (col) {
      this.collections.delete(name);
      
      // Clean up Sequelize model registration so it can be redefined safely without throwing
      const seq = this.sequelize as any;
      if (seq.models[name]) {
        delete seq.models[name];
      }
      if (seq.modelManager?.models) {
        const idx = seq.modelManager.models.findIndex((m: any) => m.name === name);
        if (idx > -1) {
          seq.modelManager.models.splice(idx, 1);
        }
      }

      this.emit('collection.remove', col);
    }
  }

  getCollections(): Collection[] {
    return Array.from(this.collections.values());
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  /**
   * Sync ALL defined collections to the database.
   */
  async sync(options?: { force?: boolean; alter?: boolean }): Promise<void> {
    // First pass: setup all relations (requires all models to exist)
    for (const col of this.collections.values()) {
      col.setupRelations();
    }

    // Second pass: sync each collection
    await this.sequelize.sync({
      force: options?.force ?? false,
      alter: options?.alter ?? false,
    });

    // Third pass: run pending migrations (adds columns, indexes, data transforms)
    try {
      const pending = await this.migrationManager.pending();
      if (pending.length > 0) {
        console.log(`[Database] ${pending.length} pending migration(s), running...`);
        await this.migrationManager.up();
      }
    } catch (err) {
      console.warn('[Database] Migration check failed:', (err as Error).message);
    }

    this.emit('sync');
  }

  /**
   * Sync a single collection to the database.
   * `transaction` is forwarded to Sequelize so DDL runs inside the same transaction
   * as the metadata insert (PostgreSQL supports transactional DDL).
   */
  async syncCollection(
    name: string,
    options?: { force?: boolean; alter?: boolean; transaction?: any },
  ): Promise<void> {
    const col = this.collections.get(name);
    if (!col) {
      throw new Error(`[Database] Collection "${name}" not found`);
    }
    col.setupRelations();
    await col.sync({ force: options?.force, alter: options?.alter, transaction: options?.transaction });
  }

  // ---------------------------------------------------------------------------
  // Repository
  // ---------------------------------------------------------------------------

  getRepository<T extends Record<string, any> = any>(
    name: string,
  ): Repository<T> {
    const col = this.collections.get(name);
    if (!col) {
      throw new Error(`[Database] Collection "${name}" not found`);
    }
    return col.repository as Repository<T>;
  }

  // ---------------------------------------------------------------------------
  // Raw query
  // ---------------------------------------------------------------------------

  async raw(sql: string, options?: any): Promise<any> {
    return this.sequelize.query(sql, options);
  }

  // ---------------------------------------------------------------------------
  // Migrations
  // ---------------------------------------------------------------------------

  /**
   * Register migrations from a plugin. Migrations are run automatically
   * during db.sync() or can be run explicitly via db.migrationManager.up().
   */
  addMigrations(migrations: Migration | Migration[]): void {
    this.migrationManager.addMigrations(migrations);
  }

  // ---------------------------------------------------------------------------
  // DDL helpers (schema-aware)
  // ---------------------------------------------------------------------------

  /**
   * Drop a table by collection name using Sequelize's queryInterface.
   * Respects the collection's configured tableName.
   * Silently succeeds if the table does not exist.
   */
  async dropTable(
    collectionName: string,
    options?: { cascade?: boolean; transaction?: any },
  ): Promise<void> {
    const col = this.collections.get(collectionName);
    const tableName = col?.options?.tableName ?? collectionName;
    const qi = this.sequelize.getQueryInterface();
    await qi.dropTable(tableName, {
      cascade: options?.cascade ?? true,
      transaction: options?.transaction,
    });
  }

  /**
   * Remove a column from a collection's table using Sequelize's queryInterface.
   * Respects the collection's configured tableName.
   */
  async removeColumn(
    collectionName: string,
    columnName: string,
    options?: { transaction?: any },
  ): Promise<void> {
    const col = this.collections.get(collectionName);
    const tableName = col?.options?.tableName ?? collectionName;
    const qi = this.sequelize.getQueryInterface();
    await qi.removeColumn(tableName, columnName, {
      transaction: options?.transaction,
    });
  }
}

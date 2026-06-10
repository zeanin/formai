import { CollectionOptions } from '@formai/shared';

/**
 * Service responsible for rebuilding the in-memory Collection registry from
 * persisted metadata on application startup.
 *
 * Design principle (mirroring NocoBase):
 *   - On startup: READ metadata → register Collection objects in memory.
 *     Do NOT execute any DDL (tables already exist from when they were created).
 *   - On user action (create/update/delete): the action handler is responsible
 *     for both updating metadata AND executing the corresponding DDL.
 *
 * This avoids the "ALTER TABLE on every restart" anti-pattern which causes:
 *   - Slow startup when there are many collections
 *   - Lock contention in production (live traffic + ALTER TABLE)
 */
export class CollectionSyncService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Rebuild the in-memory Collection + Sequelize Model for a single collection
   * by reading its metadata and field definitions from the database.
   *
   * Does NOT execute any DDL — the physical table is assumed to already exist.
   */
  async loadCollectionByName(collectionName: string): Promise<void> {
    const collectionsRepo = this.db.getRepository('collections');
    const fieldsRepo = this.db.getRepository('fields');

    const collectionMeta = await collectionsRepo.findOne({
      filter: { name: collectionName },
    });
    if (!collectionMeta) {
      throw new Error(`Collection "${collectionName}" not found in metadata`);
    }

    // Fetch all fields ordered by their sort index
    const fields = await fieldsRepo.find({
      filter: { collectionName },
      sort: ['sort'],
    });

    // Build CollectionOptions from metadata
    const collectionOptions: CollectionOptions = {
      name: collectionMeta.name,
      title: collectionMeta.title,
      fields: fields.map((f: any) => ({
        name: f.name,
        type: f.type,
        ...(f.options || {}),
      })),
      tableName: collectionMeta.options?.tableName || `t_${collectionMeta.name}`,
      ...(collectionMeta.options || {}),
    };

    // Register (or re-register) the Collection in the Database instance.
    // This creates the Sequelize Model in memory — no SQL is executed here.
    this.db.collection(collectionOptions);
  }

  /**
   * Load ALL user-defined collections from metadata into memory.
   * Called once during application startup.
   *
   * Relations (belongsTo, hasMany, etc.) are set up in a second pass after all
   * models are registered, so that target models are guaranteed to exist.
   */
  async loadAll(): Promise<void> {
    const collectionsRepo = this.db.getRepository('collections');
    if (!collectionsRepo) return;

    const allCollections = await collectionsRepo.find({});

    // First pass: register all collection models (no relations yet)
    for (const col of allCollections) {
      try {
        await this.loadCollectionByName(col.name);
      } catch (err: any) {
        console.warn(`[CollectionSyncService] Failed to load collection "${col.name}": ${err.message}`);
      }
    }

    // Second pass: set up inter-collection relations now that all models exist
    for (const col of this.db.getCollections()) {
      try {
        col.setupRelations();
      } catch (err: any) {
        console.warn(`[CollectionSyncService] Failed to setup relations for "${col.name}": ${err.message}`);
      }
    }
  }

  /**
   * Remove a collection from the in-memory registry and drop its physical table.
   * Exposed for programmatic use; the action handler also calls db.removeCollection()
   * and db.dropTable() directly, so this is a convenience wrapper.
   */
  async removeCollection(collectionName: string): Promise<void> {
    this.db.removeCollection(collectionName);
    await this.db.dropTable(collectionName, { cascade: true });
  }
}

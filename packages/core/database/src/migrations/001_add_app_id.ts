import type { Migration } from '../migration';

/**
 * Migration 001: Add appId column to core entity tables.
 *
 * This establishes the app-scoped architecture where Collections, UI Schemas,
 * Workflows, and roleResources all belong to an App.
 *
 * - collections_meta.appId: nullable (null = platform-shared)
 * - ui_schemas.appId: NOT NULL (every schema must belong to an app)
 * - workflows.appId: nullable (null = platform-level workflow)
 * - role_resources.appId: nullable (null = platform-level permission)
 */
export const migration001AddAppId: Migration = {
  name: '001_add_app_id_columns',

  async up(db: any): Promise<void> {
    // ── collections_meta ──────────────────────────────────────────────────
    await db.raw(`
      ALTER TABLE collections_meta
      ADD COLUMN IF NOT EXISTS "appId" VARCHAR(255)
    `);
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_collections_app
      ON collections_meta ("appId")
    `);

    // ── ui_schemas ────────────────────────────────────────────────────────
    // Add as nullable first (for existing rows), then set default
    await db.raw(`
      ALTER TABLE ui_schemas
      ADD COLUMN IF NOT EXISTS "appId" VARCHAR(255) NOT NULL DEFAULT '_unknown'
    `);
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_ui_schemas_app
      ON ui_schemas ("appId")
    `);
    // Remove default — future inserts must explicitly provide appId
    await db.raw(`
      ALTER TABLE ui_schemas ALTER COLUMN "appId" DROP DEFAULT
    `);

    // ── workflows ─────────────────────────────────────────────────────────
    await db.raw(`
      ALTER TABLE workflows
      ADD COLUMN IF NOT EXISTS "appId" VARCHAR(255)
    `);

    // ── role_resources ────────────────────────────────────────────────────
    await db.raw(`
      ALTER TABLE role_resources
      ADD COLUMN IF NOT EXISTS "appId" VARCHAR(255)
    `);
    await db.raw(`
      CREATE INDEX IF NOT EXISTS idx_role_resources_app
      ON role_resources ("appId")
    `);

    // ── Update unique index on role_resources to include appId ────────────
    // Drop old unique constraint and recreate with appId
    await db.raw(`
      DROP INDEX IF EXISTS uq_role_resources
    `);
    await db.raw(`
      CREATE UNIQUE INDEX uq_role_resources
      ON role_resources ("roleId", resource, "appId")
    `);

    console.log('[Migration 001] Added appId columns to core tables');
  },

  async down(db: any): Promise<void> {
    // Drop appId columns and indexes
    await db.raw(`ALTER TABLE collections_meta DROP COLUMN IF EXISTS "appId"`);
    await db.raw(`ALTER TABLE ui_schemas DROP COLUMN IF EXISTS "appId"`);
    await db.raw(`ALTER TABLE workflows DROP COLUMN IF EXISTS "appId"`);

    // Restore original role_resources unique index
    await db.raw(`DROP INDEX IF EXISTS uq_role_resources`);
    await db.raw(`CREATE UNIQUE INDEX uq_role_resources ON role_resources ("roleId", resource)`);
    await db.raw(`ALTER TABLE role_resources DROP COLUMN IF EXISTS "appId"`);

    console.log('[Migration 001] Reverted appId columns');
  },
};

/**
 * Core migration registry.
 *
 * Convention: every file in this directory exports a `Migration` object
 * whose name starts with "migration". Add a new import here when creating
 * a new migration file.
 *
 * This is the ONLY file you need to edit when adding a new core migration.
 * No changes needed in index.ts or application.ts.
 *
 * Naming convention:
 *   File:    migrations/NNN_description.ts
 *   Export:  export const migrationNNNDescription: Migration = { ... }
 */

import type { Migration } from '../migration';

// ─── Add new migration imports here ──────────────────────────────────────────
import { migration001AddAppId } from './001_add_app_id';
import { migration002AlterWorkflowsAppId } from './002_alter_workflows_app_id';

// ─── Registry (sorted by name) ───────────────────────────────────────────────
export const coreMigrations: Migration[] = [
  migration001AddAppId,
  migration002AlterWorkflowsAppId,
];

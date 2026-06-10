import { createApp } from './app';

async function runMigration() {
  console.log('[Migration] Starting database type unification...');
  const app = await createApp();

  // Initialize DB connection
  await app.init();
  await app.load();
  const db = app.db;

  try {
    const appsRepo = db.getRepository('apps');
    const skillsRepo = db.getRepository('resource_skills');
    const logsRepo = db.getRepository('skill_execution_logs');
    const workflowsRepo = db.getRepository('workflows');

    if (!appsRepo || !skillsRepo || !logsRepo || !workflowsRepo) {
      throw new Error('Required repositories not found. Ensure app has been fully initialized.');
    }

    // 1. Fetch all applications
    const apps = await appsRepo.find();
    console.log(`[Migration] Found ${apps.length} applications.`);

    // 2. Migrate appId in resource_skills_meta
    console.log('[Migration] Migrating appId in resource_skills_meta...');
    try {
      for (const appRecord of apps) {
        const { id, name } = appRecord;
        const count = await skillsRepo.update({
          filter: { appId: name },
          values: { appId: id },
        });
        if (count[0] > 0) {
          console.log(`  - Updated ${count[0]} skills for app "${name}" to numeric ID ${id}`);
        }
      }
      // Clean up any remaining invalid appId values
      await db.sequelize.query(`
        UPDATE resource_skills_meta
        SET "appId" = NULL
        WHERE "appId" IS NOT NULL AND "appId" !~ '^[0-9]+$'
      `);
    } catch (err: any) {
      console.log(`  - Skipped resource_skills_meta migration: ${err.message}`);
    }

    // 3. Migrate appId in skill_execution_logs
    console.log('[Migration] Migrating appId in skill_execution_logs...');
    try {
      for (const appRecord of apps) {
        const { id, name } = appRecord;
        const count = await logsRepo.update({
          filter: { appId: name },
          values: { appId: id },
        });
        if (count[0] > 0) {
          console.log(`  - Updated ${count[0]} execution logs for app "${name}" to numeric ID ${id}`);
        }
      }
      // Clean up any remaining invalid appId values
      await db.sequelize.query(`
        UPDATE skill_execution_logs
        SET "appId" = NULL
        WHERE "appId" IS NOT NULL AND "appId" !~ '^[0-9]+$'
      `);
    } catch (err: any) {
      console.log(`  - Skipped skill_execution_logs migration: ${err.message}`);
    }

    // 4. Migrate userId in skill_execution_logs (nullify non-numeric ones)
    console.log('[Migration] Migrating userId in skill_execution_logs...');
    try {
      await db.sequelize.query(`
        UPDATE skill_execution_logs
        SET "userId" = NULL
        WHERE "userId" IS NOT NULL AND "userId" !~ '^[0-9]+$'
      `);
    } catch (err: any) {
      console.log(`  - Skipped userId cleanup: ${err.message}`);
    }

    // 4.5. Migrate appId in workflows
    console.log('[Migration] Migrating appId in workflows...');
    try {
      for (const appRecord of apps) {
        const { id, name } = appRecord;
        const count = await workflowsRepo.update({
          filter: { appId: name },
          values: { appId: id },
        });
        if (count[0] > 0) {
          console.log(`  - Updated ${count[0]} workflows for app "${name}" to numeric ID ${id}`);
        }
      }
      // Clean up any remaining invalid appId values
      await db.sequelize.query(`
        UPDATE workflows
        SET "appId" = NULL
        WHERE "appId" IS NOT NULL AND "appId" !~ '^[0-9]+$'
      `);
    } catch (err: any) {
      console.log(`  - Skipped workflows migration: ${err.message}`);
    }

    // 5. Run DDL commands to alter column types in PostgreSQL
    console.log('[Migration] Altering column types to integer in PostgreSQL...');
    
    console.log('  - Altering resource_skills_meta.appId to integer...');
    try {
      await db.sequelize.query('ALTER TABLE resource_skills_meta ALTER COLUMN "appId" TYPE integer USING "appId"::integer;');
    } catch (err: any) {
      console.log(`    * Already integer or failed: ${err.message}`);
    }
    
    console.log('  - Altering skill_execution_logs.appId to integer...');
    try {
      await db.sequelize.query('ALTER TABLE skill_execution_logs ALTER COLUMN "appId" TYPE integer USING "appId"::integer;');
    } catch (err: any) {
      console.log(`    * Already integer or failed: ${err.message}`);
    }
    
    console.log('  - Altering skill_execution_logs.userId to integer...');
    try {
      await db.sequelize.query('ALTER TABLE skill_execution_logs ALTER COLUMN "userId" TYPE integer USING "userId"::integer;');
    } catch (err: any) {
      console.log(`    * Already integer or failed: ${err.message}`);
    }

    console.log('  - Altering workflows.appId to integer...');
    try {
      await db.sequelize.query('ALTER TABLE workflows ALTER COLUMN "appId" TYPE integer USING "appId"::integer;');
    } catch (err: any) {
      console.log(`    * Already integer or failed: ${err.message}`);
    }

    console.log('[Migration] Database type unification completed successfully!');
  } catch (err: any) {
    console.error('[Migration] Failed during migration:', err.message);
  } finally {
    await app.stop();
  }
}

runMigration().catch((err) => {
  console.error('[Migration] Unhandled error:', err);
});

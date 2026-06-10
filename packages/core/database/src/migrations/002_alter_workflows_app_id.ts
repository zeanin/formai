import type { Migration } from '../migration';

export const migration002AlterWorkflowsAppId: Migration = {
  name: '002_alter_workflows_app_id',

  async up(db: any): Promise<void> {
    const appsRepo = db.getRepository('apps');

    if (!appsRepo) {
      console.warn('[Migration 002] apps repository not found. Skipping migration logic.');
      return;
    }

    try {
      // 1. Fetch all applications
      const apps = await appsRepo.find();
      console.log(`[Migration 002] Migrating workflows for ${apps.length} applications...`);

      // 2. Check the physical data type of appId in the workflows table
      const [columnInfo] = await db.sequelize.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'workflows' AND column_name = 'appId'
      `);
      const dataType = columnInfo[0]?.data_type;

      if (dataType === 'character varying' || dataType === 'varchar' || dataType === 'text') {
        // 3. Map existing app names in workflows.appId to their numeric id using raw SQL to bypass Sequelize model type casting
        for (const appRecord of apps) {
          const { id, name } = appRecord;
          await db.sequelize.query(
            'UPDATE workflows SET "appId" = :id WHERE "appId" = :name',
            {
              replacements: { id: String(id), name },
              type: db.sequelize.QueryTypes.UPDATE,
            }
          );
          console.log(`[Migration 002] - Updated workflows for app "${name}" to numeric ID ${id}`);
        }

        // 4. Clean up any invalid non-numeric appId values in workflows
        await db.sequelize.query(`
          UPDATE workflows
          SET "appId" = NULL
          WHERE "appId" IS NOT NULL AND "appId" !~ '^[0-9]+$'
        `);

        // 5. Alter workflows.appId type to integer
        console.log('[Migration 002] Altering workflows.appId column to integer...');
        await db.sequelize.query('ALTER TABLE workflows ALTER COLUMN "appId" TYPE integer USING "appId"::integer;');
        console.log('[Migration 002] Altered workflows.appId successfully!');
      } else {
        console.log(`[Migration 002] workflows.appId is already '${dataType}', skipping type alteration.`);
      }
    } catch (err: any) {
      console.error('[Migration 002] Error altering workflows.appId:', err.message);
      throw err;
    }
  },

  async down(db: any): Promise<void> {
    console.log('[Migration 002] Reverting workflows.appId column to string...');
    try {
      await db.sequelize.query('ALTER TABLE workflows ALTER COLUMN "appId" TYPE varchar(255);');
    } catch (err: any) {
      console.error('[Migration 002] Down error:', err.message);
      throw err;
    }
  },
};

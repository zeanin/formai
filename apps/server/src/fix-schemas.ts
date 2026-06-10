import { createApp } from './app';

function fixSchemaNode(node: any, belongsToFields: Map<string, any>, currentCollection: string | null = null): { fixedCount: number } {
  let fixedCount = 0;
  if (!node || typeof node !== 'object') {
    return { fixedCount };
  }

  let activeCollection = currentCollection;
  if (node['x-component-props'] && node['x-component-props'].collection) {
    activeCollection = node['x-component-props'].collection;
  }

  // Iterate over properties of the node
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (value && typeof value === 'object') {
      if (key === 'properties') {
        for (const fieldKey of Object.keys(value)) {
          const fieldNode = value[fieldKey];
          if (fieldNode && typeof fieldNode === 'object' && fieldNode['x-component'] === 'Select') {
            if (activeCollection) {
              const fieldMetaKey = `${activeCollection}.${fieldKey}`;
              const belongsToField = belongsToFields.get(fieldMetaKey);
              if (belongsToField) {
                console.log(`  - Fixing field [${activeCollection}].[${fieldKey}] to AssociationField (Target: ${belongsToField.target})`);
                fieldNode['x-component'] = 'AssociationField';
                fieldNode['x-component-props'] = {
                  ...(fieldNode['x-component-props'] || {}),
                  collection: belongsToField.target,
                  labelField: 'name',
                  valueField: 'id',
                };
                fixedCount++;
              }
            } else {
              // Fallback to searching by fieldName only if activeCollection is not known
              for (const [metaKey, belongsToField] of belongsToFields.entries()) {
                if (metaKey.endsWith(`.${fieldKey}`)) {
                  console.log(`  - Fixing field [${fieldKey}] (fallback, Target: ${belongsToField.target})`);
                  fieldNode['x-component'] = 'AssociationField';
                  fieldNode['x-component-props'] = {
                    ...(fieldNode['x-component-props'] || {}),
                    collection: belongsToField.target,
                    labelField: 'name',
                    valueField: 'id',
                  };
                  fixedCount++;
                  break;
                }
              }
            }
          }
        }
      }

      // Recursively traverse the child
      const res = fixSchemaNode(value, belongsToFields, activeCollection);
      fixedCount += res.fixedCount;
    }
  }
  return { fixedCount };
}

async function runFix() {
  console.log('[Schema Fixer] Initializing server application and database connection...');
  const app = await createApp();
  await app.init();
  await app.load();
  const db = app.db;

  try {
    // 1. Fetch all belongsTo fields from fields_meta
    console.log('[Schema Fixer] Fetching belongsTo fields from metadata...');
    const [fields] = await db.sequelize.query(
      `SELECT name, "collectionName", options FROM fields_meta WHERE type = 'belongsTo'`
    );

    const belongsToFields = new Map<string, { target: string }>();
    for (const f of fields as any[]) {
      const key = `${f.collectionName}.${f.name}`;
      const target = f.options?.target;
      if (target) {
        belongsToFields.set(key, { target });
      }
    }
    console.log(`[Schema Fixer] Loaded ${belongsToFields.size} belongsTo metadata definitions.`);

    // 2. Fetch all ui_schemas
    console.log('[Schema Fixer] Fetching ui_schemas...');
    const [uiSchemas] = await db.sequelize.query(
      `SELECT uid, title, schema FROM ui_schemas`
    );

    let totalFixed = 0;

    // 3. Process each ui_schema
    for (const row of uiSchemas as any[]) {
      const { uid, title, schema } = row;
      if (schema && typeof schema === 'object') {
        const { fixedCount } = fixSchemaNode(schema, belongsToFields);
        if (fixedCount > 0) {
          console.log(`[Schema Fixer] Saving updated schema for "${title || uid}" (UID: ${uid}). Fixed ${fixedCount} fields.`);
          await db.sequelize.query(
            `UPDATE ui_schemas SET schema = :schema WHERE uid = :uid`,
            {
              replacements: {
                schema: JSON.stringify(schema),
                uid,
              },
            }
          );
          totalFixed += fixedCount;
        }
      }
    }

    console.log(`[Schema Fixer] Completed successfully! Total of ${totalFixed} fields fixed across the database.`);
  } catch (err: any) {
    console.error('[Schema Fixer] Failed:', err.message);
  } finally {
    await app.stop();
  }
}

runFix().catch(console.error);

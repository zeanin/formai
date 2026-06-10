import { Plugin } from '@formai/plugin';
import { uiSchemasCollection, uiSchemaVersionsCollection } from './collections/ui-schemas';
import * as schemaActions from './actions/schemas';

export default class UiSchemaStoragePlugin extends Plugin {
  async load(): Promise<void> {
    // Register collections
    this.defineCollection(uiSchemasCollection);
    this.defineCollection(uiSchemaVersionsCollection);

    // Register schema resource with custom actions
    this.registerResource({
      name: 'uiSchemas',
      actions: {
        list: schemaActions.list,
        get: schemaActions.get,
        create: schemaActions.create,
        update: schemaActions.update,
        destroy: schemaActions.destroy,
        getTree: schemaActions.getTree,
        insertAfter: schemaActions.insertAfter,
        patch: schemaActions.patch,
      },
    });
  }

  async install(): Promise<void> {
    // Ensure tables are synced
    await this.db.syncCollection('uiSchemas', { alter: true });
    await this.db.syncCollection('uiSchemaVersions', { alter: true });
  }
}

import type { CollectionOptions, FieldOptions, ResourceSkill, SkillInputSchema } from '@formai/shared';
import type { ResourceSkillRegistry, SkillExecutor } from './resource-skill-registry';

/**
 * CollectionSkillAutoGenerator
 *
 * When a Collection is registered to the platform, standard CRUD Skills are automatically
 * generated and injected into the ResourceSkillRegistry.
 *
 * Default strategy (security-first):
 *   - list / get  -> default enabled = true
 *   - create / update / delete -> default enabled = false, requires manual enablement by administrator
 */
export class CollectionSkillAutoGenerator {
  constructor(private registry: ResourceSkillRegistry) {}

  /**
   * Generate and register all CRUD Skills for a Collection.
   * @param options     Collection options (including field definitions)
   * @param appId       App ID to which it belongs
   * @param dbExecutor  Actual database query executor factory (injected by plugin)
   */
  generateAndRegister(
    options: CollectionOptions,
    appId: number | string | null,
    dbExecutor: CrudExecutorFactory,
  ): void {
    const { name: collectionName, title, fields } = options;
    const displayName = title || collectionName;

    // Only take data fields (exclude relationship fields)
    const dataFields = fields.filter(
      (f) => !['belongsTo', 'hasOne', 'hasMany', 'belongsToMany'].includes(f.type),
    );

    const skillDefs: Array<{
      action: 'list' | 'get' | 'create' | 'update' | 'delete';
      defaultEnabled: boolean;
      requiresConfirm: boolean;
    }> = [
      { action: 'list',   defaultEnabled: true,  requiresConfirm: false },
      { action: 'get',    defaultEnabled: true,  requiresConfirm: false },
      { action: 'create', defaultEnabled: false, requiresConfirm: false },
      { action: 'update', defaultEnabled: false, requiresConfirm: false },
      { action: 'delete', defaultEnabled: false, requiresConfirm: true  },
    ];

    for (const { action, defaultEnabled, requiresConfirm } of skillDefs) {
      const skill = this.buildSkill(collectionName, displayName, action, dataFields, appId, defaultEnabled, requiresConfirm);
      const executor = dbExecutor(collectionName, action);
      this.registry.register(skill, executor);
    }
  }

  /**
   * Unregister all automatically generated Skills for a certain Collection
   */
  unregister(collectionName: string): void {
    this.registry.unregisterByResource('collection', collectionName);
  }

  // ─── Build Skill definitions for each action ─────────────────────────────

  private buildSkill(
    collectionName: string,
    displayName: string,
    action: 'list' | 'get' | 'create' | 'update' | 'delete',
    fields: FieldOptions[],
    appId: number | string | null,
    enabled: boolean,
    requiresConfirm: boolean,
  ): ResourceSkill {
    const builders = {
      list:   () => this.buildListSkill(collectionName, displayName, fields, appId, enabled),
      get:    () => this.buildGetSkill(collectionName, displayName, appId, enabled),
      create: () => this.buildCreateSkill(collectionName, displayName, fields, appId, enabled),
      update: () => this.buildUpdateSkill(collectionName, displayName, fields, appId, enabled),
      delete: () => this.buildDeleteSkill(collectionName, displayName, appId, enabled, requiresConfirm),
    };
    return builders[action]();
  }

  private buildListSkill(
    collectionName: string,
    displayName: string,
    fields: FieldOptions[],
    appId: number | string | null,
    enabled: boolean,
  ): ResourceSkill {
    // Build filterable fields description
    const filterableFields = fields
      .filter((f) => !['text', 'jsonb', 'json'].includes(f.type))
      .map((f) => `${f.name}(${f.type})`)
      .join(', ');

    return {
      name: `${collectionName}_list`,
      title: `Query ${displayName} list`,
      description: `Query list data of ${displayName}. Supports filtering by fields (${filterableFields}), sorting, and pagination. Used when users want to view, search, or filter ${displayName}.`,
      resourceType: 'collection',
      resourceName: collectionName,
      appId,
      skillType: 'auto',
      enabled,
      requiresConfirm: false,
      rolesAllowed: [],
      handler: { type: 'auto_crud', collection: collectionName, action: 'list' },
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'object',
            description: `Filter conditions, supported fields: ${filterableFields}. Example: {"status": "active", "amount": {"$gte": 1000}}`,
          },
          sort: {
            type: 'array',
            description: 'Sort rules, e.g., ["-createdAt", "name"] (prefix - means descending order)',
            items: { type: 'string' },
          },
          page: {
            type: 'integer',
            description: 'Page number, starting from 1, default is 1',
            default: 1,
          },
          pageSize: {
            type: 'integer',
            description: 'Page size, default 20, max 100',
            default: 20,
          },
        },
      },
    };
  }

  private buildGetSkill(
    collectionName: string,
    displayName: string,
    appId: number | string | null,
    enabled: boolean,
  ): ResourceSkill {
    return {
      name: `${collectionName}_get`,
      title: `Get ${displayName} detail`,
      description: `Get complete details of a single ${displayName} record by ID. Used when the user wants to view the details of a specific ${displayName}.`,
      resourceType: 'collection',
      resourceName: collectionName,
      appId,
      skillType: 'auto',
      enabled,
      requiresConfirm: false,
      rolesAllowed: [],
      handler: { type: 'auto_crud', collection: collectionName, action: 'get' },
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: `Unique ID of ${displayName}`,
          },
        },
        required: ['id'],
      },
    };
  }

  private buildCreateSkill(
    collectionName: string,
    displayName: string,
    fields: FieldOptions[],
    appId: number | string | null,
    enabled: boolean,
  ): ResourceSkill {
    const writableFields = fields.filter(
      (f) => !f.primaryKey && !f.autoIncrement,
    );
    const requiredFields = writableFields.filter((f) => f.allowNull === false && f.defaultValue === undefined);

    return {
      name: `${collectionName}_create`,
      title: `Create ${displayName}`,
      description: `Create a new ${displayName} record. Used when the user wants to create or add a ${displayName}. Required fields: ${requiredFields.map((f) => f.name).join(', ') || 'none'}.`,
      resourceType: 'collection',
      resourceName: collectionName,
      appId,
      skillType: 'auto',
      enabled,
      requiresConfirm: false,
      rolesAllowed: [],
      handler: { type: 'auto_crud', collection: collectionName, action: 'create' },
      inputSchema: {
        type: 'object',
        properties: {
          values: {
            type: 'object',
            description: `Data of the ${displayName} to create, supported fields: ${writableFields.map((f) => `${f.name}(${f.type})`).join(', ')}`,
          },
        },
        required: ['values'],
      },
    };
  }

  private buildUpdateSkill(
    collectionName: string,
    displayName: string,
    fields: FieldOptions[],
    appId: number | string | null,
    enabled: boolean,
  ): ResourceSkill {
    const updatableFields = fields.filter(
      (f) => !f.primaryKey && !f.autoIncrement,
    );

    return {
      name: `${collectionName}_update`,
      title: `Update ${displayName}`,
      description: `Update some or all fields of a ${displayName} record by ID. Used when the user wants to modify or edit ${displayName}.`,
      resourceType: 'collection',
      resourceName: collectionName,
      appId,
      skillType: 'auto',
      enabled,
      requiresConfirm: false,
      rolesAllowed: [],
      handler: { type: 'auto_crud', collection: collectionName, action: 'update' },
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: `ID of the ${displayName} to update`,
          },
          values: {
            type: 'object',
            description: `Fields and values to update, supported fields: ${updatableFields.map((f) => `${f.name}(${f.type})`).join(', ')}`,
          },
        },
        required: ['id', 'values'],
      },
    };
  }

  private buildDeleteSkill(
    collectionName: string,
    displayName: string,
    appId: number | string | null,
    enabled: boolean,
    requiresConfirm: boolean,
  ): ResourceSkill {
    return {
      name: `${collectionName}_delete`,
      title: `Delete ${displayName}`,
      description: `Delete a ${displayName} record by ID. This is a dangerous operation that will prompt for confirmation before execution. Used when the user explicitly requests to delete a ${displayName}.`,
      resourceType: 'collection',
      resourceName: collectionName,
      appId,
      skillType: 'auto',
      enabled,
      requiresConfirm,
      rolesAllowed: [],
      handler: { type: 'auto_crud', collection: collectionName, action: 'delete' },
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: `ID of the ${displayName} to delete`,
          },
        },
        required: ['id'],
      },
    };
  }
}

/**
 * CRUD executor factory type.
 * Injected by collection-manager plugin, translates skill arguments into actual DB operations.
 */
export type CrudExecutorFactory = (
  collectionName: string,
  action: 'list' | 'get' | 'create' | 'update' | 'delete',
) => SkillExecutor;


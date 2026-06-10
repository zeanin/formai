import { Plugin } from '@formai/plugin';
import { CollectionSkillAutoGenerator, ResourceSkillRegistry } from '@formai/ai';
import { collectionsCollection, fieldsCollection } from './collections/collections';
import { resourceSkillsCollection } from './collections/resource-skills';
import { skillExecutionLogsCollection } from './collections/skill-execution-logs';
import * as collectionActions from './actions/collections';
import * as fieldActions from './actions/fields';
import { CollectionSyncService } from './services/collection-sync';
import { createCrudExecutorFactory } from './services/crud-executor-factory';

// ─── Permission helpers ────────────────────────────────────────────────────────

/** Roles that can configure Skills (read + write resource_skills). */
const ADMIN_ROLES = new Set(['root', 'admin', 'developer']);

/**
 * requireAdminRole — Guard writing operations to only allow administrators.
 * Returns 403 if called by normal users.
 */
function requireAdminRole(ctx: any): boolean {
  const role = ctx.state?.currentRole;
  const user = ctx.state?.currentUser;
  if (!user) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Please log in first', code: 'UNAUTHORIZED' }] };
    return false;
  }
  if (!ADMIN_ROLES.has(role)) {
    ctx.status = 403;
    ctx.body = { errors: [{ message: 'Forbidden: Administrator role required to manage AI Skills configuration', code: 'FORBIDDEN' }] };
    return false;
  }
  return true;
}

/**
 * requireLogin — Any logged-in user can call (used for read-only operations).
 */
function requireLogin(ctx: any): boolean {
  if (!ctx.state?.currentUser) {
    ctx.status = 401;
    ctx.body = { errors: [{ message: 'Please log in first', code: 'UNAUTHORIZED' }] };
    return false;
  }
  return true;
}

export default class CollectionManagerPlugin extends Plugin {
  private syncService!: CollectionSyncService;
  private skillGenerator!: CollectionSkillAutoGenerator;

  async load(): Promise<void> {
    // ── Metadata collections registration ────────────────────────────────────

    this.defineCollection(collectionsCollection);
    this.defineCollection(fieldsCollection);
    this.defineCollection(resourceSkillsCollection);
    this.defineCollection(skillExecutionLogsCollection);

    // ── Services initialization ──────────────────────────────────────────────

    this.syncService = new CollectionSyncService(this.db);

    // Get global ResourceSkillRegistry from app (registered by AI plugin)
    // If AI plugin is not loaded (e.g. test environment), skip skill registration
    const skillRegistry: ResourceSkillRegistry | undefined = (this.app as any).skillRegistry;
    if (skillRegistry) {
      this.skillGenerator = new CollectionSkillAutoGenerator(skillRegistry);
    }

    // ── Resource Actions registration ────────────────────────────────────────

    this.registerResource({
      name: 'collections',
      actions: {
        list: collectionActions.list,
        get: collectionActions.get,
        create: this.wrapCreateWithSkills(collectionActions.create),
        update: collectionActions.update,
        destroy: this.wrapDestroyWithSkills(collectionActions.destroy),
      },
    });

    this.registerResource({
      name: 'fields',
      actions: {
        list: fieldActions.list,
        get: fieldActions.get,
        create: fieldActions.create,
        update: fieldActions.update,
        destroy: fieldActions.destroy,
      },
    });

    // CRUD API for resource_skills
    this.registerResource({
      name: 'resource_skills',
      actions: {
        list: this.skillsListAction.bind(this),
        get:  this.skillsGetAction.bind(this),
        create: this.skillsCreateAction.bind(this),
        update: this.skillsUpdateAction.bind(this),
        destroy: this.skillsDestroyAction.bind(this),
      },
    });

    // Query API for skill_execution_logs
    this.registerResource({
      name: 'skill_execution_logs',
      only: ['list', 'get'],
      actions: {
        list: this.logsListAction.bind(this),
        get:  async (ctx: any, next: any) => {
          const repo = this.db.getRepository('skill_execution_logs');
          const row = await repo?.findById(ctx.action?.params?.filterByTk).catch(() => null);
          if (!row) { ctx.status = 404; ctx.body = { errors: [{ message: 'Not found', code: 'NOT_FOUND' }] }; return; }
          ctx.body = { data: row };
          await next();
        },
      },
    });

    // ── Sync metadata after DB connection ───────────────────────────────────

    const setupSync = async () => {
      try {
        // Load all user-defined collections into memory (no DDL executed here —
        // tables were already created when the collections were originally created).
        await this.syncService.loadAll();
        await this.loadSkillsFromDB();
      } catch (err: any) {
        console.warn(`[CollectionManagerPlugin] Setup sync failed:`, err.message);
      }
    };

    if (this.db.sequelize) {
      // If Sequelize is already connected, run sync on next tick to ensure boot sequence completes
      setImmediate(setupSync);
    } else {
      this.db.on('connected', setupSync);
    }
  }

  async install(): Promise<void> {
    await this.db.syncCollection('collections', { alter: true });
    await this.db.syncCollection('fields', { alter: true });
    await this.db.syncCollection('resource_skills', { alter: true });
    await this.db.syncCollection('skill_execution_logs', { alter: true });
  }

  // ── Collection lifecycle hooks (auto-generate/unregister Skills) ──────────

  /**
   * Wrap create action: Automatically generate corresponding Skills after Collection creation
   */
  private wrapCreateWithSkills(originalCreate: Function) {
    return async (ctx: any, next: any) => {
      await originalCreate(ctx, next);

      // If creation succeeds and skillGenerator is available, automatically generate Skills
      if (ctx.status === 201 && this.skillGenerator) {
        try {
          const { values } = ctx.action.params;
          const appIdParam = values?.appId || null;
          const appId = await this.resolveNumericAppId(appIdParam);
          const collectionOptions = {
            name: values.name,
            title: values.title || values.name,
            fields: values.fields || [],
            ...(values.options || {}),
          };

          const executorFactory = createCrudExecutorFactory(this.db);
          this.skillGenerator.generateAndRegister(collectionOptions, appId, executorFactory);

          // Persist Skills to DB
          await this.persistAutoSkills(collectionOptions, appId);
        } catch (err) {
          // Skill generation failure does not affect the collection creation itself
          console.warn(`[AI Skills] Failed to generate skills for collection: ${(err as Error).message}`);
        }
      }
    };
  }

  /**
   * Wrap destroy action: Automatically unregister corresponding Skills after Collection deletion
   */
  private wrapDestroyWithSkills(originalDestroy: Function) {
    return async (ctx: any, next: any) => {
      const { filterByTk } = ctx.action?.params || {};
      await originalDestroy(ctx, next);

      if (this.skillGenerator && filterByTk) {
        try {
          this.skillGenerator.unregister(filterByTk);

          // Delete corresponding Skills from DB
          const skillsRepo = this.db.getRepository('resource_skills');
          if (skillsRepo) {
            await skillsRepo.destroy({
              filter: { resourceType: 'collection', resourceName: filterByTk },
            });
          }
        } catch (err) {
          console.warn(`[AI Skills] Failed to unregister skills: ${(err as Error).message}`);
        }
      }
    };
  }

  // ── Load existing Skills when DB starts ──────────────────────────────────

  /**
   * Load all Skills from the resource_skills metadata table and register them to the Registry
   */
  private async loadSkillsFromDB(): Promise<void> {
    if (!this.skillGenerator) return;

    try {
      const skillsRepo = this.db.getRepository('resource_skills');
      if (!skillsRepo) return;

      const skillRecords = await skillsRepo.find({ filter: { skillType: 'auto' } });
      const executorFactory = createCrudExecutorFactory(this.db);

      for (const record of skillRecords) {
        const skillRegistry: ResourceSkillRegistry = (this.app as any).skillRegistry;
        if (!skillRegistry || skillRegistry.has(record.name)) continue;

        // Rebuild ResourceSkill and register it
        const skill = {
          name: record.name,
          title: record.title,
          description: record.description,
          resourceType: record.resourceType,
          resourceName: record.resourceName,
          appId: record.appId ? Number(record.appId) : null,
          skillType: record.skillType,
          enabled: record.enabled,
          requiresConfirm: record.requiresConfirm,
          rolesAllowed: record.rolesAllowed || [],
          inputSchema: record.inputSchema,
          handler: record.handler,
        };

        // Parse handler.action for executor factory
        const handlerAction = record.handler?.action;
        if (!handlerAction) continue;

        const executor = executorFactory(record.resourceName, handlerAction);
        skillRegistry.register(skill, executor);
      }
    } catch (err) {
      console.warn(`[AI Skills] Failed to load skills from DB: ${(err as Error).message}`);
    }
  }

  /**
   * Persist automatically generated Skills to the resource_skills table
   */
  private async persistAutoSkills(
    collectionOptions: any,
    appIdParam: number | string | null,
  ): Promise<void> {
    const appId = await this.resolveNumericAppId(appIdParam);
    const skillsRepo = this.db.getRepository('resource_skills');
    if (!skillsRepo) return;

    const skillRegistry: ResourceSkillRegistry = (this.app as any).skillRegistry;
    if (!skillRegistry) return;

    // Get the newly generated skills of these collections
    const allSkills = skillRegistry.list().filter(
      (s) => s.resourceType === 'collection' && s.resourceName === collectionOptions.name,
    );

    for (const skillMeta of allSkills) {
      const skillName = skillMeta.name;
      // Check if it already exists
      const existing = await skillsRepo.findOne({ filter: { name: skillName } }).catch(() => null);
      if (existing) continue;

      // Get complete skill info from registry (needs reconstruction from internal list since registry only exposes summary)
      // Simplified solution: get corresponding info from list action
      const action = skillName.replace(`${collectionOptions.name}_`, '') as any;
      const defaultEnabled = ['list', 'get'].includes(action);
      const requiresConfirm = action === 'delete';

      await skillsRepo.create({
        values: {
          name: skillName,
          title: skillMeta.resourceName, // Temporary, actually provided by generator
          description: `Auto-generated ${action} skill for ${collectionOptions.name}`,
          resourceType: 'collection',
          resourceName: collectionOptions.name,
          appId,
          skillType: 'auto',
          enabled: defaultEnabled,
          requiresConfirm,
          rolesAllowed: [],
          handler: { type: 'auto_crud', collection: collectionOptions.name, action },
          inputSchema: { type: 'object', properties: {} },
          options: {},
        },
      });
    }
  }

  // ── resource_skills CRUD Actions ─────────────────────────────────────────

  private async skillsListAction(ctx: any, next: any): Promise<void> {
    // Read operation: requires login (both admins and normal users belonging to the same App can retrieve the enabled Skills list)
    if (!requireLogin(ctx)) return;

    const repo = this.db.getRepository('resource_skills');
    const { filter, page = 1, pageSize = 50, sort } = ctx.action?.params || {};

    const filterObj = { ...(filter || {}) };
    if (filterObj.appId !== undefined) {
      filterObj.appId = await this.resolveNumericAppId(filterObj.appId);
    }

    const { rows, count } = await repo.findAndCount({
      filter: filterObj,
      sort: sort || ['resourceType', 'resourceName', 'name'],
      page: Number(page),
      pageSize: Number(pageSize),
    });

    ctx.body = {
      data: rows,
      meta: { count, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(count / Number(pageSize)) },
    };
    await next();
  }

  private async skillsGetAction(ctx: any, next: any): Promise<void> {
    // Read operation: requires login
    if (!requireLogin(ctx)) return;

    const repo = this.db.getRepository('resource_skills');
    const { filterByTk } = ctx.action?.params || {};

    const row = await repo.findOne({ filter: { name: filterByTk } })
      || await repo.findById(filterByTk).catch(() => null);

    if (!row) {
      ctx.status = 404;
      ctx.body = { errors: [{ message: 'Skill not found', code: 'NOT_FOUND' }] };
      return;
    }
    ctx.body = { data: row };
    await next();
  }

  private async skillsCreateAction(ctx: any, next: any): Promise<void> {
    // Write operation: only administrators can create
    if (!requireAdminRole(ctx)) return;

    const repo = this.db.getRepository('resource_skills');
    const { values } = ctx.action?.params || {};

    if (!values?.name || !values?.resourceType || !values?.resourceName) {
      ctx.status = 400;
      ctx.body = { errors: [{ message: 'name, resourceType, resourceName are required', code: 'VALIDATION_ERROR' }] };
      return;
    }

    if (values.appId !== undefined) {
      values.appId = await this.resolveNumericAppId(values.appId);
    }

    const record = await repo.create({ values });
    ctx.status = 201;
    ctx.body = { data: record };
    await next();
  }

  private async skillsUpdateAction(ctx: any, next: any): Promise<void> {
    // Write operation: only administrators can modify Skill configuration (enable/disable, requiresConfirm, rolesAllowed, etc.)
    if (!requireAdminRole(ctx)) return;

    const repo = this.db.getRepository('resource_skills');
    const { filterByTk, values } = ctx.action?.params || {};

    if (values && values.appId !== undefined) {
      values.appId = await this.resolveNumericAppId(values.appId);
    }

    const updated = await repo.update({ filter: { name: filterByTk }, values });

    // Synchronously update skill in Registry (when enabled status changes)
    if (values?.enabled !== undefined) {
      const skillRegistry: ResourceSkillRegistry = (this.app as any).skillRegistry;
      const record = await repo.findOne({ filter: { name: filterByTk } });
      if (skillRegistry && record) {
        const skill = {
          name: record.name,
          title: record.title,
          description: record.description,
          resourceType: record.resourceType,
          resourceName: record.resourceName,
          appId: record.appId ? Number(record.appId) : null,
          skillType: record.skillType,
          enabled: record.enabled,
          requiresConfirm: record.requiresConfirm,
          rolesAllowed: record.rolesAllowed || [],
          inputSchema: record.inputSchema,
          handler: record.handler,
        };
        const executorFactory = createCrudExecutorFactory(this.db);
        const executor = executorFactory(record.resourceName, record.handler?.action);
        skillRegistry.register(skill, executor);
      }
    }

    ctx.body = { data: updated };
    await next();
  }

  private async skillsDestroyAction(ctx: any, next: any): Promise<void> {
    // Write operation: only administrators can delete Skill
    if (!requireAdminRole(ctx)) return;

    const repo = this.db.getRepository('resource_skills');
    const { filterByTk } = ctx.action?.params || {};

    const skillRegistry: ResourceSkillRegistry = (this.app as any).skillRegistry;
    if (skillRegistry) {
      skillRegistry.unregister(filterByTk);
    }

    const count = await repo.destroy({ filter: { name: filterByTk } });
    ctx.body = { data: count };
    await next();
  }

  private async resolveNumericAppId(appId: string | number | null | undefined): Promise<number | null> {
    if (!appId) return null;
    if (!isNaN(Number(appId))) {
      return Number(appId);
    }
    try {
      const appsRepo = this.db.getRepository('apps');
      const appRecord = await appsRepo.findOne({ filter: { name: appId } });
      return appRecord ? appRecord.id : null;
    } catch {
      return null;
    }
  }

  getSyncService(): CollectionSyncService {
    return this.syncService;
  }

  private async logsListAction(ctx: any, next: any): Promise<void> {
    // Execution logs: only administrators can view (audit logs are sensitive information)
    if (!requireAdminRole(ctx)) return;

    const repo = this.db.getRepository('skill_execution_logs');
    if (!repo) {
      ctx.body = { data: [], meta: { count: 0 } };
      return;
    }

    const { filter, page = 1, pageSize = 50, sort } = ctx.action?.params || {};
    const { skillName, appId, userId, sessionId } = ctx.query || {};

    const filterObj: Record<string, any> = { ...(filter || {}) };
    if (skillName) filterObj.skillName = skillName;
    if (appId)     filterObj.appId = await this.resolveNumericAppId(appId);
    if (filterObj.appId !== undefined) {
      filterObj.appId = await this.resolveNumericAppId(filterObj.appId);
    }
    if (userId)    filterObj.userId = isNaN(Number(userId)) ? userId : Number(userId);
    if (sessionId) filterObj.sessionId = sessionId;

    const { rows, count } = await repo.findAndCount({
      filter: filterObj,
      sort: sort || ['-createdAt'],
      page: Number(page),
      pageSize: Math.min(Number(pageSize), 200),
    });

    ctx.body = {
      data: rows,
      meta: {
        count,
        page: Number(page),
        pageSize: Math.min(Number(pageSize), 200),
        totalPages: Math.ceil(count / Math.min(Number(pageSize), 200)),
      },
    };
    await next();
  }
}


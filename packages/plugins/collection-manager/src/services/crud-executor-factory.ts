import type { SkillContext } from '@formai/shared';
import type { CrudExecutorFactory, SkillExecutor } from '@formai/ai';

/**
 * createCrudExecutorFactory
 *
 * Returns a CrudExecutorFactory. When CollectionSkillAutoGenerator generates CRUD Skills
 * for a certain Collection, this factory is injected to produce the actual DB executor.
 *
 * The executor translates skill args -> DB Repository calls.
 *
 * @param db  FormAI Database instance (app.db)
 */
export function createCrudExecutorFactory(db: any): CrudExecutorFactory {
  return (collectionName: string, action: 'list' | 'get' | 'create' | 'update' | 'delete'): SkillExecutor => {
    return async (args: Record<string, any>, _context: SkillContext): Promise<any> => {
      const repo = db.getRepository(collectionName);
      if (!repo) {
        throw new Error(`Repository for collection "${collectionName}" not found`);
      }

      switch (action) {
        case 'list': {
          const { filter, sort, page = 1, pageSize = 20 } = args;
          const { rows, count } = await repo.findAndCount({
            filter: filter || {},
            sort: sort || ['-createdAt'],
            page: Number(page),
            pageSize: Math.min(Number(pageSize), 100), // Max 100 rows, to prevent abuse
          });
          return {
            data: rows,
            meta: {
              count,
              page: Number(page),
              pageSize: Math.min(Number(pageSize), 100),
              totalPages: Math.ceil(count / Math.min(Number(pageSize), 100)),
            },
          };
        }

        case 'get': {
          const { id } = args;
          if (!id) throw new Error('id is required');
          const row = await repo.findById(id);
          if (!row) {
            throw new Error(`Record with id "${id}" not found in ${collectionName}`);
          }
          return { data: row };
        }

        case 'create': {
          const { values } = args;
          if (!values || typeof values !== 'object') {
            throw new Error('values object is required');
          }
          const record = await repo.create({ values });
          return { data: record };
        }

        case 'update': {
          const { id, values } = args;
          if (!id) throw new Error('id is required');
          if (!values || typeof values !== 'object') {
            throw new Error('values object is required');
          }
          const updated = await repo.update({
            filter: { id },
            values,
          });
          return { data: updated };
        }

        case 'delete': {
          const { id } = args;
          if (!id) throw new Error('id is required');
          const count = await repo.destroy({ filter: { id } });
          return { data: { deleted: count } };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    };
  };
}


import {
  Model,
  ModelStatic,
  Op,
  WhereOptions,
  FindOptions as SeqFindOptions,
  Order,
  Transaction,
} from 'sequelize';
import {
  Filter,
  FindOptions,
  CreateOptions,
  UpdateOptions,
  DestroyOptions,
} from '@formai/shared';

// Map our operator names → Sequelize Op symbols
const OP_MAP: Record<string, symbol> = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gt: Op.gt,
  $gte: Op.gte,
  $lt: Op.lt,
  $lte: Op.lte,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $in: Op.in,
  $notIn: Op.notIn,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $is: Op.is,
  $isNot: Op.not,
};

export class Repository<T extends Record<string, any> = any> {
  model: ModelStatic<Model>;
  collection: any; // Collection reference

  constructor(model: ModelStatic<Model>, collection: any) {
    this.model = model;
    this.collection = collection;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async find(options?: FindOptions): Promise<T[]> {
    const seqOptions = this.buildFindOptions(options);
    const rows = await this.model.findAll(seqOptions);
    return rows.map((r) => r.toJSON() as T);
  }

  async findOne(options?: FindOptions): Promise<T | null> {
    const seqOptions = this.buildFindOptions(options);
    const row = await this.model.findOne(seqOptions);
    return row ? (row.toJSON() as T) : null;
  }

  async findById(id: any): Promise<T | null> {
    const row = await this.model.findByPk(id);
    return row ? (row.toJSON() as T) : null;
  }

  async count(options?: { filter?: Filter }): Promise<number> {
    return this.model.count({
      where: this.buildWhere(options?.filter),
    });
  }

  async findAndCount(
    options?: FindOptions,
  ): Promise<{ rows: T[]; count: number }> {
    const seqOptions = this.buildFindOptions(options);
    const { rows, count } = await this.model.findAndCountAll(seqOptions);
    return {
      rows: rows.map((r) => r.toJSON() as T),
      count,
    };
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(options: CreateOptions): Promise<T> {
    let values = { ...options.values };

    if (options.whitelist?.length) {
      values = Object.fromEntries(
        Object.entries(values).filter(([k]) => options.whitelist!.includes(k)),
      );
    }
    if (options.blacklist?.length) {
      values = Object.fromEntries(
        Object.entries(values).filter(
          ([k]) => !options.blacklist!.includes(k),
        ),
      );
    }

    const instance = await this.model.create(values, {
      transaction: options.transaction,
    });
    return instance.toJSON() as T;
  }

  async createMany(
    records: Array<{ values: Record<string, any> }>,
  ): Promise<T[]> {
    const rows = records.map((r) => r.values);
    const instances = await this.model.bulkCreate(rows);
    return instances.map((i) => i.toJSON() as T);
  }

  async update(options: UpdateOptions): Promise<T[]> {
    let values = { ...options.values };

    if (options.whitelist?.length) {
      values = Object.fromEntries(
        Object.entries(values).filter(([k]) => options.whitelist!.includes(k)),
      );
    }
    if (options.blacklist?.length) {
      values = Object.fromEntries(
        Object.entries(values).filter(
          ([k]) => !options.blacklist!.includes(k),
        ),
      );
    }

    // Build where clause
    const where: WhereOptions = {};

    if (options.filterByTk !== undefined) {
      const pkField = this.getPrimaryKeyField();
      (where as any)[pkField] = options.filterByTk;
    } else if (options.filter) {
      Object.assign(where, this.buildWhere(options.filter));
    }

    const [, affected] = await this.model.update(values, {
      where,
      returning: true,
      transaction: options.transaction,
    });

    // `returning` is Postgres-specific; affected may be an array of instances
    if (Array.isArray(affected) && affected.length > 0) {
      return affected.map((i: Model) => i.toJSON() as T);
    }

    // Fallback: re-query after update
    const rows = await this.model.findAll({ where, transaction: options.transaction });
    return rows.map((r) => r.toJSON() as T);
  }

  async destroy(options: DestroyOptions): Promise<number> {
    const where: WhereOptions = {};

    if (options.filterByTk !== undefined) {
      const pkField = this.getPrimaryKeyField();
      (where as any)[pkField] = options.filterByTk;
    } else if (options.filter) {
      Object.assign(where, this.buildWhere(options.filter));
    }

    return this.model.destroy({ where, transaction: options.transaction });
  }

  // ---------------------------------------------------------------------------
  // Raw query
  // ---------------------------------------------------------------------------

  async raw(sql: string, options?: any): Promise<any> {
    return this.model.sequelize!.query(sql, options);
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * Execute a callback inside a managed Sequelize transaction.
   * The transaction is committed on success and rolled back on error.
   *
   * Usage:
   *   await repo.transaction(async (t) => {
   *     await repo.create({ values: {...}, transaction: t });
   *     await otherRepo.update({ filter: {...}, values: {...}, transaction: t });
   *   });
   */
  async transaction<R>(callback: (transaction: Transaction) => Promise<R>): Promise<R> {
    const sequelize = this.model.sequelize;
    if (!sequelize) {
      throw new Error('[Repository] Sequelize instance is not available on this model.');
    }
    return sequelize.transaction(callback);
  }

  // ---------------------------------------------------------------------------
  // Soft-delete helpers (paranoid)
  // ---------------------------------------------------------------------------

  /**
   * Restore a soft-deleted record by primary key.
   * Requires the Sequelize model to be defined with paranoid: true.
   */
  async restore(id: any): Promise<void> {
    const instance = await this.model.findByPk(id, { paranoid: false });
    if (!instance) {
      throw new Error(`[Repository] Record with id=${id} not found (including deleted)`);
    }
    await (instance as any).restore();
  }

  /**
   * Permanently hard-delete a soft-deleted record.
   * Only relevant when the model uses paranoid: true.
   */
  async destroyPermanently(id: any): Promise<void> {
    const instance = await this.model.findByPk(id, { paranoid: false });
    if (!instance) {
      throw new Error(`[Repository] Record with id=${id} not found`);
    }
    await instance.destroy({ force: true });
  }

  /**
   * Find records including soft-deleted ones (paranoid bypass).
   */
  async findWithDeleted(options?: FindOptions): Promise<T[]> {
    const seqOptions = this.buildFindOptions(options);
    const rows = await this.model.findAll({ ...seqOptions, paranoid: false });
    return rows.map((r) => r.toJSON() as T);
  }

  // ---------------------------------------------------------------------------
  // Bulk upsert
  // ---------------------------------------------------------------------------

  /**
   * Insert or update many records. Uses Sequelize's bulkCreate with updateOnDuplicate.
   * `conflictFields` specifies which fields determine uniqueness (default: primary key).
   */
  async upsertMany(
    records: Array<Record<string, any>>,
    conflictFields?: string[],
  ): Promise<T[]> {
    const updateKeys = Object.keys(records[0] ?? {}).filter(
      (k) => !(conflictFields ?? []).includes(k),
    );
    const instances = await this.model.bulkCreate(records, {
      updateOnDuplicate: updateKeys.length > 0 ? updateKeys : undefined,
    });
    return instances.map((i) => i.toJSON() as T);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getPrimaryKeyField(): string {
    const pks = Object.entries(this.model.rawAttributes)
      .filter(([, attr]) => (attr as any).primaryKey)
      .map(([name]) => name);
    return pks[0] ?? 'id';
  }

  private buildFindOptions(options?: FindOptions): SeqFindOptions {
    if (!options) return {};

    const seqOptions: SeqFindOptions = {};

    // Where
    if (options.filter) {
      seqOptions.where = this.buildWhere(options.filter);
    }

    // Attributes (fields / except)
    const attrs = this.buildAttributes(options);
    if (attrs !== undefined) {
      seqOptions.attributes = attrs;
    }

    // Order
    if (options.sort?.length) {
      seqOptions.order = this.buildOrder(options.sort);
    }

    // Pagination
    let limit = options.limit;
    let offset = options.offset;

    if (options.page !== undefined && options.pageSize !== undefined) {
      limit = options.pageSize;
      offset = (options.page - 1) * options.pageSize;
    }

    if (limit !== undefined) seqOptions.limit = limit;
    if (offset !== undefined) seqOptions.offset = offset;

    // Appends → include associations
    if (options.appends?.length) {
      seqOptions.include = options.appends.map((assocName: string) => ({
        association: assocName,
      }));
    }

    return seqOptions;
  }

  /**
   * Convert our Filter format to Sequelize WhereOptions.
   *
   * Supports:
   *   - $and, $or
   *   - $eq, $ne, $gt, $gte, $lt, $lte
   *   - $like, $notLike, $iLike
   *   - $in, $notIn
   *   - $between, $notBetween
   *   - $is, $isNot
   *   - dot-notation keys → Sequelize $assoc.field$ syntax
   *   - plain value → $eq
   */
  buildWhere(filter?: Filter): WhereOptions {
    if (!filter) return {};

    const result: any = {};

    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;

      // Top-level logical operators
      if (key === '$and') {
        result[Op.and] = (value as Filter[]).map((f) => this.buildWhere(f));
        continue;
      }
      if (key === '$or') {
        result[Op.or] = (value as Filter[]).map((f) => this.buildWhere(f));
        continue;
      }

      // Dot-notation → association path  e.g. 'profile.name' → '$profile.name$'
      const fieldKey = key.includes('.') ? `$${key}$` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Object — may contain operator keys or be a nested condition
        const operatorCondition: any = {};
        let hasOperator = false;

        for (const [op, operand] of Object.entries(value as object)) {
          const seqOp = OP_MAP[op];
          if (seqOp) {
            operatorCondition[seqOp] = operand;
            hasOperator = true;
          }
        }

        if (hasOperator) {
          result[fieldKey] = operatorCondition;
        } else {
          // Nested plain object — treat as equality on JSON field
          result[fieldKey] = { [Op.eq]: value };
        }
      } else {
        // Plain value → equality
        result[fieldKey] = value;
      }
    }

    return result as WhereOptions;
  }

  private buildOrder(sort?: string[]): Order {
    if (!sort?.length) return [];

    return sort.map((s) => {
      if (s.startsWith('-')) {
        return [s.slice(1), 'DESC'];
      }
      return [s, 'ASC'];
    }) as Order;
  }

  private buildAttributes(
    options: FindOptions,
  ): SeqFindOptions['attributes'] {
    const { fields, except } = options;

    if (fields?.length && except?.length) {
      // fields takes precedence when both are supplied
      return fields;
    }
    if (fields?.length) return fields;
    if (except?.length) return { exclude: except };
    return undefined;
  }
}

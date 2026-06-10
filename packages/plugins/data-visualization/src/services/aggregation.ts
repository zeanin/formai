import type { AggregationOptions, AggregationResult, DateGrouping } from '../types';

/**
 * Aggregation query builder service.
 * Constructs and executes aggregation queries via the Database repository layer.
 */
export class AggregationService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Execute an aggregation query and return result rows.
   */
  async query(options: AggregationOptions): Promise<AggregationResult[]> {
    const { collection, metrics, groupByField, dateField, dateGrouping, filters, limit, sort, sortOrder } = options;

    const repo = this.db.getRepository(collection);
    if (!repo) {
      throw new Error(`Collection "${collection}" not found`);
    }

    // Use raw sequelize query for flexible aggregation
    const sequelize = this.db.sequelize;
    const tableInfo = this.db.getCollection(collection);
    const tableName = tableInfo?.tableName || collection;

    const selectParts: string[] = [];
    const groupByParts: string[] = [];

    // Build date grouping expression
    if (dateField && dateGrouping) {
      const dateTrunc = this.buildDateTrunc(dateField, dateGrouping);
      selectParts.push(`${dateTrunc} AS "date_group"`);
      groupByParts.push(dateTrunc);
    }

    // Build group-by field
    if (groupByField) {
      selectParts.push(`"${groupByField}"`);
      groupByParts.push(`"${groupByField}"`);
    }

    // Build metric expressions
    for (const metric of metrics) {
      const alias = metric.alias || `${metric.aggregation || 'value'}_${metric.field}`;
      if (metric.aggregation) {
        if (metric.aggregation === 'count') {
          if (metric.field === '*') {
            selectParts.push(`COUNT(*) AS "${alias}"`);
          } else {
            selectParts.push(`COUNT("${metric.field}") AS "${alias}"`);
          }
        } else {
          selectParts.push(`${metric.aggregation.toUpperCase()}("${metric.field}") AS "${alias}"`);
        }
      } else {
        selectParts.push(`"${metric.field}" AS "${alias}"`);
        groupByParts.push(`"${metric.field}"`);
      }
    }

    if (selectParts.length === 0) {
      selectParts.push('COUNT(*) AS "count"');
    }

    // Build WHERE clause from filters
    const { whereClause, replacements } = this.buildWhereClause(filters || {});

    const groupByClause = groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : '';
    const orderClause = sort ? `ORDER BY "${sort}" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}` : '';
    const limitClause = limit ? `LIMIT ${Number(limit)}` : '';

    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM "${tableName}"
      ${whereClause}
      ${groupByClause}
      ${orderClause}
      ${limitClause}
    `.trim();

    try {
      const [results] = await sequelize.query(sql, {
        replacements,
        type: sequelize.QueryTypes ? sequelize.QueryTypes.SELECT : 'SELECT',
      });

      return Array.isArray(results) ? results : [results];
    } catch (err: any) {
      throw new Error(`Aggregation query failed: ${err.message}`);
    }
  }

  /**
   * Build a PostgreSQL date_trunc expression.
   */
  private buildDateTrunc(field: string, grouping: DateGrouping): string {
    const pgUnit = grouping === 'day' ? 'day'
      : grouping === 'week' ? 'week'
      : grouping === 'month' ? 'month'
      : 'year';
    return `DATE_TRUNC('${pgUnit}', "${field}")`;
  }

  /**
   * Build a simple WHERE clause from a key-value filter map.
   * Supports eq, gt, gte, lt, lte, like operators via {field: {$op: value}} style.
   */
  private buildWhereClause(filters: Record<string, unknown>): { whereClause: string; replacements: Record<string, unknown> } {
    const conditions: string[] = [];
    const replacements: Record<string, unknown> = {};
    let idx = 0;

    for (const [field, value] of Object.entries(filters)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const ops = value as Record<string, unknown>;
        for (const [op, opValue] of Object.entries(ops)) {
          const key = `p${idx++}`;
          switch (op) {
            case '$eq': conditions.push(`"${field}" = :${key}`); replacements[key] = opValue; break;
            case '$gt': conditions.push(`"${field}" > :${key}`); replacements[key] = opValue; break;
            case '$gte': conditions.push(`"${field}" >= :${key}`); replacements[key] = opValue; break;
            case '$lt': conditions.push(`"${field}" < :${key}`); replacements[key] = opValue; break;
            case '$lte': conditions.push(`"${field}" <= :${key}`); replacements[key] = opValue; break;
            case '$like': conditions.push(`"${field}" LIKE :${key}`); replacements[key] = opValue; break;
            default: break;
          }
        }
      } else {
        const key = `p${idx++}`;
        conditions.push(`"${field}" = :${key}`);
        replacements[key] = value;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, replacements };
  }
}

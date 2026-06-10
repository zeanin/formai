import { CsvWriter } from './csv-writer';
import type { ExportOptions } from '../types';

/**
 * Queries data from a collection and formats it as CSV.
 */
export class ExportProcessor {
  private db: any;
  private writer: CsvWriter;

  constructor(db: any) {
    this.db = db;
    this.writer = new CsvWriter();
  }

  /**
   * Export data to CSV string.
   */
  async exportToCsv(options: ExportOptions): Promise<{ csv: string; totalRows: number }> {
    const { collection, fields, filter, sort, limit } = options;

    const repo = this.db.getRepository(collection);
    if (!repo) {
      throw new Error(`Collection "${collection}" not found`);
    }

    // Fetch all matching records (up to limit)
    const rows = await repo.find({
      filter: filter || {},
      fields: fields,
      sort: sort || ['-createdAt'],
      pageSize: limit || 10000,
    });

    if (rows.length === 0) {
      const headers = fields || [];
      return { csv: this.writer.write(headers, []), totalRows: 0 };
    }

    // Determine headers from fields or first row keys
    const headers = fields || Object.keys(rows[0]).filter((k) => !k.startsWith('_'));

    // Convert model instances to plain objects
    const plainRows: Record<string, unknown>[] = rows.map((r: any) => {
      const obj: Record<string, unknown> = {};
      for (const h of headers) {
        obj[h] = r[h] !== undefined ? r[h] : '';
      }
      return obj;
    });

    const csv = this.writer.write(headers, plainRows);
    return { csv, totalRows: plainRows.length };
  }
}

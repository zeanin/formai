import type { ImportOptions, ImportRowError } from '../types';

/**
 * Processes imported CSV rows: validates fields, transforms values, inserts records.
 */
export class ImportProcessor {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Process all rows and insert valid records.
   * Returns list of per-row errors.
   */
  async process(
    options: ImportOptions,
    onProgress?: (processed: number) => Promise<void>,
  ): Promise<ImportRowError[]> {
    const { collection, headers, data, fieldMap } = options;
    const repo = this.db.getRepository(collection);
    if (!repo) {
      throw new Error(`Collection "${collection}" not found`);
    }

    const errors: ImportRowError[] = [];

    for (let i = 0; i < data.length; i++) {
      const rawRow = data[i];
      const rowNum = i + 2; // 1-based + header row

      try {
        // Build record object from CSV row
        const record: Record<string, unknown> = {};
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const targetField = fieldMap?.[header] ?? header;
          const value = rawRow[j] ?? '';
          record[targetField] = value === '' ? null : this.coerceValue(value);
        }

        await repo.create({ values: record });
      } catch (err: any) {
        errors.push({ row: rowNum, message: err.message });
      }

      if (onProgress) {
        await onProgress(i + 1);
      }
    }

    return errors;
  }

  /**
   * Try to coerce a string value to a number or boolean when appropriate.
   */
  private coerceValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    return value;
  }
}

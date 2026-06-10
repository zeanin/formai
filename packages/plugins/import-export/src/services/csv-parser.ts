import type { ParsedCSV } from '../types';

/**
 * Parse a CSV string into headers and data rows.
 * Handles quoted fields and escaped quotes.
 */
export class CsvParser {
  parse(csvContent: string): ParsedCSV {
    const lines = this.splitLines(csvContent);
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = this.parseLine(lines[0]);
    const rows: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      rows.push(this.parseLine(line));
    }

    return { headers, rows };
  }

  private splitLines(content: string): string[] {
    return content.split(/\r?\n/);
  }

  private parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }

    fields.push(current.trim());
    return fields;
  }
}

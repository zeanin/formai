/**
 * Write arrays of objects to CSV string format.
 */
export class CsvWriter {
  /**
   * Convert an array of row objects to a CSV string.
   */
  write(headers: string[], rows: Record<string, unknown>[]): string {
    const lines: string[] = [];

    // Header row
    lines.push(headers.map((h) => this.escapeField(h)).join(','));

    // Data rows
    for (const row of rows) {
      const fields = headers.map((h) => {
        const val = row[h];
        return this.escapeField(val !== null && val !== undefined ? String(val) : '');
      });
      lines.push(fields.join(','));
    }

    return lines.join('\r\n');
  }

  private escapeField(value: string): string {
    // Wrap in quotes if value contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }
}

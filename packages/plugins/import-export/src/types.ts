export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImportJobRecord {
  id: number;
  collection: string;
  status: ImportJobStatus;
  filename: string;
  totalRows: number;
  processedRows: number;
  errors: ImportRowError[];
  createdById?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportOptions {
  collection: string;
  data: string[][];
  headers: string[];
  fieldMap?: Record<string, string>;
}

export interface ExportOptions {
  collection: string;
  fields?: string[];
  filter?: Record<string, unknown>;
  sort?: string[];
  limit?: number;
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'table-stat';

export type AggregationFunction = 'count' | 'sum' | 'avg' | 'min' | 'max';

export type DateGrouping = 'day' | 'week' | 'month' | 'year';

export interface ChartFieldConfig {
  field: string;
  aggregation?: AggregationFunction;
  alias?: string;
}

export interface ChartConfig {
  type: ChartType;
  collection: string;
  xField?: string;
  yField?: string;
  groupByField?: string;
  metrics: ChartFieldConfig[];
  filters?: Record<string, unknown>;
  dateField?: string;
  dateGrouping?: DateGrouping;
  limit?: number;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AggregationOptions {
  collection: string;
  metrics: ChartFieldConfig[];
  groupByField?: string;
  dateField?: string;
  dateGrouping?: DateGrouping;
  filters?: Record<string, unknown>;
  limit?: number;
  sort?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AggregationResult {
  [key: string]: unknown;
}

export interface ChartData {
  rows: AggregationResult[];
  meta: {
    total: number;
    executedAt: string;
  };
}

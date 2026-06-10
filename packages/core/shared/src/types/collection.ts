export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'double'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'jsonb'
  | 'uuid'
  | 'array'
  | 'password'
  | 'enum'
  | 'virtual';

export type RelationType = 'belongsTo' | 'hasOne' | 'hasMany' | 'belongsToMany';

export interface FieldOptions {
  name: string;
  type: FieldType | RelationType;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  allowNull?: boolean;
  defaultValue?: any;
  unique?: boolean;
  index?: boolean;
  comment?: string;
  // String options
  length?: number;
  // Number options
  precision?: number;
  scale?: number;
  // Enum options
  values?: string[];
  // Relation options
  target?: string;
  foreignKey?: string;
  sourceKey?: string;
  targetKey?: string;
  through?: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface IndexOptions {
  fields: string[];
  unique?: boolean;
  name?: string;
  type?: 'BTREE' | 'GIN' | 'GIST';
}

export interface CollectionOptions {
  name: string;
  title?: string;
  fields: FieldOptions[];
  timestamps?: boolean;
  paranoid?: boolean; // soft delete
  tableName?: string;
  comment?: string;
  indexes?: IndexOptions[];
  tree?: 'adjacency-list' | 'closure-table' | 'materialized-path';
  sortable?: boolean | string;
}

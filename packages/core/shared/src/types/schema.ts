export type SchemaType = 'void' | 'object' | 'array' | 'string' | 'number' | 'boolean';

export interface ValidatorRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  message?: string;
  validator?: string; // custom validator name
}

export interface Reaction {
  dependencies?: string[];
  when?: string; // expression
  fulfill?: {
    state?: Record<string, any>;
    schema?: Partial<ISchema>;
    run?: string; // expression
  };
  otherwise?: {
    state?: Record<string, any>;
    schema?: Partial<ISchema>;
    run?: string;
  };
}

export interface ISchema {
  type?: SchemaType;
  name?: string;
  title?: string;
  description?: string;
  default?: any;
  enum?: Array<{ label: string; value: any }>;
  'x-component'?: string;
  'x-component-props'?: Record<string, any>;
  'x-decorator'?: string;
  'x-decorator-props'?: Record<string, any>;
  'x-reactions'?: Reaction | Reaction[];
  'x-visible'?: boolean;
  'x-hidden'?: boolean;
  'x-disabled'?: boolean;
  'x-read-only'?: boolean;
  'x-editable'?: boolean;
  'x-validator'?: ValidatorRule | ValidatorRule[];
  'x-data'?: Record<string, any>;
  'x-uid'?: string;
  'x-async'?: boolean;
  'x-index'?: number;
  'x-pattern'?: 'editable' | 'disabled' | 'readPretty';
  'x-display'?: 'visible' | 'hidden' | 'none';
  'x-content'?: any;
  properties?: Record<string, ISchema>;
  items?: ISchema;
  required?: boolean | string[];
  [key: string]: any;
}

export interface PageSchema {
  type: 'page';
  title: string;
  schema: ISchema;
  route?: string;
  icon?: string;
  sort?: number;
}

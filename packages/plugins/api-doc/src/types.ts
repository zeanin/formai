export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenAPISpec {
  openapi: '3.0.3';
  info: OpenAPIInfo;
  paths: Record<string, OpenAPIPathItem>;
  components: {
    schemas: Record<string, OpenAPISchema>;
    securitySchemes: Record<string, unknown>;
  };
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation;
}

export interface OpenAPIOperation {
  summary: string;
  operationId: string;
  tags: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: OpenAPISchemaRef }>;
  };
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema: OpenAPISchema;
  description?: string;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, { schema: OpenAPISchema | OpenAPISchemaRef }>;
}

export type OpenAPISchema = {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema | OpenAPISchemaRef>;
  items?: OpenAPISchema | OpenAPISchemaRef;
  required?: string[];
  description?: string;
  example?: unknown;
};

export type OpenAPISchemaRef = { $ref: string };

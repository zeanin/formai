import type {
  OpenAPISpec,
  OpenAPISchema,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIParameter,
} from '../types';

const FIELD_TYPE_MAP: Record<string, { type: string; format?: string }> = {
  string: { type: 'string' },
  text: { type: 'string' },
  integer: { type: 'integer', format: 'int32' },
  bigint: { type: 'integer', format: 'int64' },
  float: { type: 'number', format: 'float' },
  double: { type: 'number', format: 'double' },
  boolean: { type: 'boolean' },
  date: { type: 'string', format: 'date' },
  datetime: { type: 'string', format: 'date-time' },
  jsonb: { type: 'object' },
  json: { type: 'object' },
};

const STANDARD_ACTIONS = ['list', 'get', 'create', 'update', 'destroy'];

/**
 * Generates an OpenAPI 3.0 spec from registered collections and resources.
 */
export class OpenApiGenerator {
  private db: any;
  private resourcer: any;

  constructor(db: any, resourcer: any) {
    this.db = db;
    this.resourcer = resourcer;
  }

  generate(): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: '3.0.3',
      info: {
        title: 'Formai API',
        version: '1.0.0',
        description: 'Auto-generated API documentation',
      },
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Api-Key',
          },
        },
      },
      security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    };

    // Build schemas and paths from collections
    const collections = this.getCollections();
    for (const collection of collections) {
      const schemaName = this.capitalize(collection.name);
      spec.components.schemas[schemaName] = this.buildSchema(collection);
      this.addResourcePaths(spec, collection);
    }

    return spec;
  }

  private getCollections(): Array<{ name: string; fields: Array<{ name: string; type: string; allowNull?: boolean }> }> {
    try {
      if (!this.db) return [];
      const collections = this.db.collections;
      if (!collections) return [];
      if (collections instanceof Map) {
        return Array.from(collections.values()).map((c: any) => ({
          name: c.name || c.options?.name,
          fields: c.fields || c.options?.fields || [],
        }));
      }
      if (typeof collections === 'object') {
        return Object.values(collections).map((c: any) => ({
          name: c.name || c.options?.name,
          fields: c.fields || c.options?.fields || [],
        }));
      }
    } catch { /* ignore */ }
    return [];
  }

  private buildSchema(collection: { name: string; fields: Array<{ name: string; type: string; allowNull?: boolean }> }): OpenAPISchema {
    const properties: Record<string, OpenAPISchema> = {
      id: { type: 'integer', format: 'int32', description: 'Primary key' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    };

    for (const field of collection.fields) {
      const mapped = FIELD_TYPE_MAP[field.type] || { type: 'string' };
      properties[field.name] = { ...mapped };
    }

    return { type: 'object', properties };
  }

  private addResourcePaths(spec: OpenAPISpec, collection: { name: string; fields: Array<{ name: string; type: string }> }): void {
    const name = collection.name;
    const schemaRef = `#/components/schemas/${this.capitalize(name)}`;
    const tag = this.capitalize(name);

    const listPath = `/api/${name}`;
    const itemPath = `/api/${name}/{id}`;

    const commonParams: OpenAPIParameter[] = [
      { name: 'page', in: 'query', schema: { type: 'integer' }, description: 'Page number' },
      { name: 'pageSize', in: 'query', schema: { type: 'integer' }, description: 'Items per page' },
      { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Sort field (prefix with - for DESC)' },
      { name: 'filter', in: 'query', schema: { type: 'string' }, description: 'JSON filter object' },
    ];

    const listOp: OpenAPIOperation = {
      summary: `List ${name}`,
      operationId: `list${tag}`,
      tags: [tag],
      parameters: commonParams,
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: schemaRef } },
                  meta: { type: 'object', properties: { count: { type: 'integer' }, page: { type: 'integer' } } },
                },
              },
            },
          },
        },
      },
      security: [{ BearerAuth: [] }],
    };

    const createOp: OpenAPIOperation = {
      summary: `Create ${name}`,
      operationId: `create${tag}`,
      tags: [tag],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: schemaRef } } },
      },
      responses: {
        '201': { description: 'Created', content: { 'application/json': { schema: { $ref: schemaRef } } } },
        '400': { description: 'Validation error' },
      },
      security: [{ BearerAuth: [] }],
    };

    spec.paths[listPath] = { get: listOp, post: createOp } as OpenAPIPathItem;

    const idParam: OpenAPIParameter = {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'integer' },
      description: 'Record ID',
    };

    const getOp: OpenAPIOperation = {
      summary: `Get ${name} by ID`,
      operationId: `get${tag}`,
      tags: [tag],
      parameters: [idParam],
      responses: {
        '200': { description: 'Success', content: { 'application/json': { schema: { $ref: schemaRef } } } },
        '404': { description: 'Not found' },
      },
      security: [{ BearerAuth: [] }],
    };

    const updateOp: OpenAPIOperation = {
      summary: `Update ${name}`,
      operationId: `update${tag}`,
      tags: [tag],
      parameters: [idParam],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: schemaRef } } },
      },
      responses: {
        '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: schemaRef } } } },
        '404': { description: 'Not found' },
      },
      security: [{ BearerAuth: [] }],
    };

    const deleteOp: OpenAPIOperation = {
      summary: `Delete ${name}`,
      operationId: `delete${tag}`,
      tags: [tag],
      parameters: [idParam],
      responses: {
        '200': { description: 'Deleted' },
        '404': { description: 'Not found' },
      },
      security: [{ BearerAuth: [] }],
    };

    spec.paths[itemPath] = { get: getOp, put: updateOp, delete: deleteOp } as OpenAPIPathItem;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

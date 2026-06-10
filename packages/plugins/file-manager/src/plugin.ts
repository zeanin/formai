import { Plugin } from '@formai/plugin';
import { attachmentsCollection } from './collections/attachments';
import { StorageEngine } from './storage/base';
import { LocalStorageEngine, LocalStorageOptions } from './storage/local';
import { createUploadAction } from './actions/upload';
import { createDownloadAction } from './actions/download';
import { createDestroyAction } from './actions/destroy';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Context, Next } from 'koa';

export interface FileManagerPluginOptions {
  storage?: {
    type: 'local';
    local?: LocalStorageOptions;
  };
  upload?: {
    maxFileSize?: number;
    allowedMimetypes?: string[];
  };
}

export default class FileManagerPlugin extends Plugin {
  private storageEngine!: StorageEngine;
  private fileManagerOptions: FileManagerPluginOptions;

  constructor(app: any, options: any) {
    super(app, options);
    this.fileManagerOptions = options?.fileManager || {};
  }

  async load(): Promise<void> {
    // Initialize storage engine
    const storageType = this.fileManagerOptions.storage?.type || 'local';
    if (storageType === 'local') {
      const localOptions = this.fileManagerOptions.storage?.local || {
        basePath: path.resolve(process.cwd(), 'storage', 'uploads'),
        baseUrl: '/api/uploads',
      };
      if (!localOptions.baseUrl) {
        localOptions.baseUrl = '/api/uploads';
      }
      this.storageEngine = new LocalStorageEngine(localOptions);

      // Ensure upload directory exists
      await fs.mkdir(localOptions.basePath, { recursive: true });
    } else {
      throw new Error(`Unsupported storage type: ${storageType}`);
    }

    // Register attachments collection
    this.defineCollection(attachmentsCollection);

    // Serve uploaded files under /api/uploads
    this.addMiddleware(async (ctx: Context, next: Next) => {
      const match = ctx.path.match(/^\/api\/uploads\/(.+)$/);
      if (match && ctx.method === 'GET') {
        const relativePath = decodeURIComponent(match[1]);
        try {
          const data = await this.storageEngine.read(relativePath);
          
          // Look up mimetype in attachments database
          const repo = (ctx as any).app.db.getRepository('attachments');
          const attachment = await repo.findOne({ filter: { path: relativePath } });
          const mimetype = attachment?.mimetype || 'application/octet-stream';

          ctx.set('Content-Type', mimetype);
          ctx.set('Content-Length', String(data.length));
          ctx.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
          ctx.body = data;
          return;
        } catch (err) {
          ctx.status = 404;
          ctx.body = { errors: [{ message: 'File not found', code: 'NOT_FOUND' }] };
          return;
        }
      }
      await next();
    });

    // Register resource actions
    this.registerResource({
      name: 'attachments',
      actions: {
        upload: createUploadAction(this.storageEngine, this.fileManagerOptions.upload),
        download: createDownloadAction(this.storageEngine),
        destroy: createDestroyAction(this.storageEngine),
      },
    });
  }

  async install(): Promise<void> {
    await this.db.syncCollection('attachments', { alter: true });
  }

  /**
   * Get the storage engine instance (for use by other plugins)
   */
  getStorageEngine(): StorageEngine {
    return this.storageEngine;
  }
}


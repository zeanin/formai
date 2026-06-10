import { Context, Next } from 'koa';
import { StorageEngine } from '../storage/base';

// Default validation settings
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_MIMETYPES: string[] = []; // Empty = all types allowed

export interface UploadOptions {
  maxFileSize?: number;
  allowedMimetypes?: string[];
}

/**
 * File upload action.
 * Expects multipart form data with a "file" field.
 */
export function createUploadAction(storageEngine: StorageEngine, options?: UploadOptions) {
  const maxFileSize = options?.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  const allowedMimetypes = options?.allowedMimetypes || DEFAULT_ALLOWED_MIMETYPES;

  return async (ctx: Context, next: Next): Promise<void> => {
    // Check if the request has file data
    // koa-bodyparser doesn't handle multipart; we read from ctx.request.files if available
    // or fall back to raw body parsing
    const files = (ctx.request as any).files;
    if (!files || !files.file) {
      ctx.status = 400;
      ctx.body = { errors: [{ message: 'No file uploaded. Use multipart form with "file" field.', code: 'VALIDATION_ERROR' }] };
      return;
    }

    const file = files.file;
    const filename = file.name || file.originalFilename || 'untitled';
    const mimetype = file.type || file.mimetype || 'application/octet-stream';
    const size = file.size || 0;

    // Validate file size
    if (size > maxFileSize) {
      ctx.status = 413;
      ctx.body = { errors: [{ message: `File size exceeds limit (${maxFileSize} bytes)`, code: 'FILE_TOO_LARGE' }] };
      return;
    }

    // Validate mimetype
    if (allowedMimetypes.length > 0 && !allowedMimetypes.includes(mimetype)) {
      ctx.status = 415;
      ctx.body = { errors: [{ message: `File type "${mimetype}" is not allowed`, code: 'INVALID_FILE_TYPE' }] };
      return;
    }

    try {
      // Read file content from the temporary path
      const { promises: fs } = await import('node:fs');
      const data = await fs.readFile(file.path || file.filepath);

      // Write to storage
      const relativePath = await storageEngine.write(filename, data);
      const url = storageEngine.getUrl(relativePath);

      // Save attachment record to database
      const repo = (ctx as any).app.db.getRepository('attachments');
      const currentUser = (ctx as any).state?.currentUser;

      const record = await repo.create({
        values: {
          filename,
          path: relativePath,
          mimetype,
          size,
          storageType: storageEngine.name,
          url,
          createdById: currentUser?.id || null,
        },
      });

      ctx.status = 201;
      ctx.body = { data: record };
    } catch (err: any) {
      ctx.status = 500;
      ctx.body = { errors: [{ message: `Upload failed: ${err.message}`, code: 'UPLOAD_ERROR' }] };
    }

    await next();
  };
}

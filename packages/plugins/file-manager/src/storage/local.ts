import { promises as fs } from 'node:fs';
import path from 'node:path';
import { StorageEngine } from './base';

export interface LocalStorageOptions {
  /** Base directory for storing files (absolute path) */
  basePath: string;
  /** Base URL for serving files publicly */
  baseUrl?: string;
}

export class LocalStorageEngine implements StorageEngine {
  name = 'local';
  private basePath: string;
  private baseUrl: string;

  constructor(options: LocalStorageOptions) {
    this.basePath = options.basePath;
    this.baseUrl = options.baseUrl || '/uploads';
  }

  async write(filename: string, data: Buffer): Promise<string> {
    // Organize files by date: basePath/YYYY/MM/DD/filename
    const now = new Date();
    const dateDir = path.join(
      this.basePath,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    );

    // Ensure directory exists
    await fs.mkdir(dateDir, { recursive: true });

    // Generate unique filename to avoid collisions
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const uniqueName = `${baseName}-${Date.now()}${ext}`;
    const filePath = path.join(dateDir, uniqueName);

    await fs.writeFile(filePath, data as any);

    // Return relative path from basePath
    return path.relative(this.basePath, filePath);
  }

  async read(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, relativePath);
    return fs.readFile(fullPath);
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  getUrl(relativePath: string): string {
    return `${this.baseUrl}/${relativePath.replace(/\\/g, '/')}`;
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

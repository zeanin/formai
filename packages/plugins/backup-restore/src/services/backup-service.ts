import { join } from 'path';
import { existsSync, statSync, mkdirSync } from 'fs';
import { PgDump } from './pg-dump';

export interface BackupServiceOptions {
  db: any;
  storageDir: string;
}

export interface BackupResult {
  filename: string;
  storagePath: string;
  size: number;
  type: 'full' | 'config';
}

/**
 * Coordinates the backup process for both full DB and config-only backups.
 */
export class BackupService {
  private db: any;
  private storageDir: string;
  private pgDump: PgDump;

  constructor(options: BackupServiceOptions) {
    this.db = options.db;
    this.storageDir = options.storageDir;
    this.pgDump = new PgDump();

    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Create a full database backup using pg_dump.
   */
  async backupFull(): Promise<BackupResult> {
    const config = this.getDbConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-full-${timestamp}.dump`;
    const storagePath = join(this.storageDir, filename);

    await this.pgDump.dump({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      outputPath: storagePath,
      format: 'custom',
    });

    const size = statSync(storagePath).size;
    return { filename, storagePath, size, type: 'full' };
  }

  /**
   * Create a config-only backup (collections, schemas, settings) as JSON.
   */
  async backupConfig(): Promise<BackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-config-${timestamp}.json`;
    const storagePath = join(this.storageDir, filename);

    const configData: Record<string, unknown> = {};

    // Export collections metadata
    try {
      const collectionsRepo = this.db.getRepository('collections');
      if (collectionsRepo) {
        configData['collections'] = await collectionsRepo.find({});
      }
    } catch { /* ignore */ }

    // Export system settings
    try {
      const settingsRepo = this.db.getRepository('systemSettings');
      if (settingsRepo) {
        configData['systemSettings'] = await settingsRepo.find({});
      }
    } catch { /* ignore */ }

    // Export roles and permissions
    try {
      const rolesRepo = this.db.getRepository('roles');
      if (rolesRepo) {
        configData['roles'] = await rolesRepo.find({});
      }
    } catch { /* ignore */ }

    const json = JSON.stringify(configData, null, 2);
    const { writeFileSync } = await import('fs');
    writeFileSync(storagePath, json, 'utf-8');

    const size = statSync(storagePath).size;
    return { filename, storagePath, size, type: 'config' };
  }

  /**
   * Restore from a full backup file.
   */
  async restoreFull(storagePath: string): Promise<void> {
    if (!existsSync(storagePath)) {
      throw new Error(`Backup file not found: ${storagePath}`);
    }

    const config = this.getDbConfig();
    await this.pgDump.restore({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      inputPath: storagePath,
      format: 'custom',
    });
  }

  /**
   * Parse the DB connection config from sequelize.
   */
  private getDbConfig(): { host: string; port: number; database: string; username: string; password?: string } {
    try {
      const seq = this.db.sequelize;
      const opts = seq?.config || seq?.options || {};
      return {
        host: opts.host || process.env['DB_HOST'] || 'localhost',
        port: Number(opts.port) || Number(process.env['DB_PORT']) || 5432,
        database: opts.database || process.env['DB_DATABASE'] || 'formai',
        username: opts.username || process.env['DB_USERNAME'] || 'postgres',
        password: opts.password || process.env['DB_PASSWORD'],
      };
    } catch {
      return {
        host: process.env['DB_HOST'] || 'localhost',
        port: Number(process.env['DB_PORT']) || 5432,
        database: process.env['DB_DATABASE'] || 'formai',
        username: process.env['DB_USERNAME'] || 'postgres',
        password: process.env['DB_PASSWORD'],
      };
    }
  }
}

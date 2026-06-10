import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface PgDumpOptions {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  outputPath: string;
  format?: 'plain' | 'custom' | 'tar';
}

export interface PgRestoreOptions {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  inputPath: string;
  format?: 'plain' | 'custom' | 'tar';
}

/**
 * Wrapper around pg_dump and pg_restore CLI tools.
 */
export class PgDump {
  /**
   * Run pg_dump and write to outputPath.
   */
  async dump(options: PgDumpOptions): Promise<void> {
    const { host, port, database, username, password, outputPath, format = 'custom' } = options;

    const args = [
      '-h', host,
      '-p', String(port),
      '-U', username,
      '-d', database,
      '-F', format === 'plain' ? 'p' : format === 'tar' ? 't' : 'c',
      '-f', outputPath,
      '--no-password',
    ];

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (password) {
      env['PGPASSWORD'] = password;
    }

    await execFileAsync('pg_dump', args, { env });
  }

  /**
   * Run pg_restore from inputPath.
   * For plain SQL format use psql instead.
   */
  async restore(options: PgRestoreOptions): Promise<void> {
    const { host, port, database, username, password, inputPath, format = 'custom' } = options;

    const env: NodeJS.ProcessEnv = { ...process.env };
    if (password) {
      env['PGPASSWORD'] = password;
    }

    if (format === 'plain') {
      // Use psql for plain SQL files
      const args = [
        '-h', host,
        '-p', String(port),
        '-U', username,
        '-d', database,
        '-f', inputPath,
        '--no-password',
      ];
      await execFileAsync('psql', args, { env });
    } else {
      const args = [
        '-h', host,
        '-p', String(port),
        '-U', username,
        '-d', database,
        '-F', format === 'tar' ? 't' : 'c',
        '--clean',
        '--no-owner',
        '--no-password',
        inputPath,
      ];
      await execFileAsync('pg_restore', args, { env });
    }
  }
}

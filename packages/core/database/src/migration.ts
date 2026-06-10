export interface Migration {
  name: string;
  up(db: any): Promise<void>;
  down(db: any): Promise<void>;
}

export interface MigrationRecord {
  name: string;
  appliedAt: Date;
}

export class MigrationManager {
  private migrations: Migration[] = [];
  private db: any;
  private tableName: string;

  constructor(db: any, options?: { tableName?: string; migrations?: Migration[] }) {
    this.db = db;
    this.tableName = options?.tableName ?? 'migrations';
    // Auto-register any migrations passed at construction time
    if (options?.migrations) {
      this.addMigrations(options.migrations);
    }
  }

  /**
   * Register one or more migration objects.
   */
  addMigrations(migrations: Migration | Migration[]): void {
    const list = Array.isArray(migrations) ? migrations : [migrations];
    for (const m of list) {
      if (!this.migrations.find((x) => x.name === m.name)) {
        this.migrations.push(m);
      }
    }
    // Keep sorted by name (chronological when named with timestamps)
    this.migrations.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Ensure the migrations tracking table exists.
   */
  private async ensureTable(): Promise<void> {
    await this.db.raw(`
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async getApplied(): Promise<string[]> {
    const [rows] = await this.db.raw(
      `SELECT name FROM "${this.tableName}" ORDER BY name ASC`,
    );
    return (rows as Array<{ name: string }>).map((r) => r.name);
  }

  /**
   * Returns migrations that have not yet been applied.
   */
  async pending(): Promise<Migration[]> {
    await this.ensureTable();
    const applied = await this.getApplied();
    return this.migrations.filter((m) => !applied.includes(m.name));
  }

  /**
   * Run all pending migrations in order.
   */
  async up(): Promise<void> {
    await this.ensureTable();
    const applied = await this.getApplied();
    const toRun = this.migrations.filter((m) => !applied.includes(m.name));

    for (const migration of toRun) {
      console.log(`[Migration] Running: ${migration.name}`);
      await migration.up(this.db);
      await this.db.raw(
        `INSERT INTO "${this.tableName}" (name) VALUES (?)`,
        { replacements: [migration.name] },
      );
      console.log(`[Migration] Applied: ${migration.name}`);
    }
  }

  /**
   * Revert the last applied migration.
   */
  async down(): Promise<void> {
    await this.ensureTable();
    const applied = await this.getApplied();
    if (applied.length === 0) {
      console.log('[Migration] Nothing to revert.');
      return;
    }

    const lastName = applied[applied.length - 1];
    const migration = this.migrations.find((m) => m.name === lastName);
    if (!migration) {
      throw new Error(
        `[Migration] Cannot revert "${lastName}" — migration definition not found.`,
      );
    }

    console.log(`[Migration] Reverting: ${migration.name}`);
    await migration.down(this.db);
    await this.db.raw(
      `DELETE FROM "${this.tableName}" WHERE name = ?`,
      { replacements: [migration.name] },
    );
    console.log(`[Migration] Reverted: ${migration.name}`);
  }

  /**
   * Revert all applied migrations (in reverse order).
   */
  async downAll(): Promise<void> {
    await this.ensureTable();
    const applied = await this.getApplied();
    const toRevert = [...applied].reverse();

    for (const name of toRevert) {
      const migration = this.migrations.find((m) => m.name === name);
      if (!migration) {
        console.warn(
          `[Migration] Skipping revert of "${name}" — definition not found.`,
        );
        continue;
      }
      console.log(`[Migration] Reverting: ${migration.name}`);
      await migration.down(this.db);
      await this.db.raw(
        `DELETE FROM "${this.tableName}" WHERE name = ?`,
        { replacements: [name] },
      );
    }
  }
}

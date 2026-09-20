import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseBinding, PreparedQuery, SqlValue } from "./database";

class SqlitePreparedQuery implements PreparedQuery {
  constructor(
    private readonly owner: SqliteDatabaseBinding,
    private readonly sql: string,
    private readonly values: SqlValue[] = [],
  ) {}

  bind(...values: SqlValue[]): PreparedQuery {
    return new SqlitePreparedQuery(this.owner, this.sql, values);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.owner.connection.prepare(this.sql).get(...this.values) as T | undefined;
    return row ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const results = this.owner.connection.prepare(this.sql).all(...this.values) as T[];
    return { results };
  }

  async run(): Promise<{ success: true; changes: number; lastRowId: number | bigint }> {
    const result = this.runSynchronously();
    return { success: true, changes: result.changes, lastRowId: result.lastInsertRowid };
  }

  belongsTo(database: SqliteDatabaseBinding): boolean {
    return this.owner === database;
  }

  executeForBatch(): unknown {
    const statement = this.owner.connection.prepare(this.sql);
    if (statement.reader) return statement.all(...this.values);
    const result = statement.run(...this.values);
    return { success: true, changes: result.changes, lastRowId: result.lastInsertRowid };
  }

  private runSynchronously() {
    return this.owner.connection.prepare(this.sql).run(...this.values);
  }
}

class SqliteDatabaseBinding implements DatabaseBinding {
  readonly connection: Database.Database;

  constructor(databasePath: string) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    this.connection = new Database(resolvedPath);
    this.connection.pragma("foreign_keys = ON");
    this.connection.pragma("journal_mode = WAL");
    this.connection.pragma("busy_timeout = 5000");
  }

  prepare(sql: string): PreparedQuery {
    return new SqlitePreparedQuery(this, sql);
  }

  async batch(statements: PreparedQuery[]): Promise<unknown[]> {
    const sqliteStatements = statements.map((statement) => {
      if (!(statement instanceof SqlitePreparedQuery) || !statement.belongsTo(this)) {
        throw new Error("O lote contém uma instrução de outra conexão SQLite.");
      }
      return statement;
    });
    return this.connection.transaction(() => sqliteStatements.map((statement) => statement.executeForBatch()))();
  }

  close(): void {
    if (this.connection.open) this.connection.close();
  }
}

export function createSqliteDatabase(databasePath: string): DatabaseBinding {
  return new SqliteDatabaseBinding(databasePath);
}

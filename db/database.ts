export type SqlValue = string | number | bigint | Buffer | null;

export interface PreparedQuery {
  bind(...values: SqlValue[]): PreparedQuery;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: true; changes: number; lastRowId: number | bigint }>;
}

export interface DatabaseBinding {
  prepare(sql: string): PreparedQuery;
  batch(statements: PreparedQuery[]): Promise<unknown[]>;
  close(): void;
}

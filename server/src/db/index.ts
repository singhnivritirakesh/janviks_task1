import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

let dbInstance: DbClient | null = null;

// Better-sqlite3 client implementation
function createSqliteClient(dbPath: string): DbClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const stmtCache = new Map<string, any>();
  function getStmt(sql: string) {
    let stmt = stmtCache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  function prepareSqlite(sql: string, params: unknown[]): { sqliteSql: string; sqliteParams: unknown[] } {
    const sqliteParams: unknown[] = [];
    const sqliteSql = sql.replace(/\$(\d+)/g, (_, idxStr) => {
      const idx = parseInt(idxStr, 10) - 1;
      sqliteParams.push(params[idx]);
      return '?';
    });
    return { sqliteSql, sqliteParams: sqliteParams.length > 0 ? sqliteParams : params };
  }

  const client: DbClient = {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const { sqliteSql, sqliteParams } = prepareSqlite(sql, params);
      const stmt = getStmt(sqliteSql);
      const rows = stmt.all(...sqliteParams) as T[];
      return { rows, rowCount: rows.length };
    },
    async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const res = await this.query<T>(sql, params);
      return res.rows.length > 0 ? res.rows[0] : null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
      const { sqliteSql, sqliteParams } = prepareSqlite(sql, params);
      const stmt = getStmt(sqliteSql);
      const info = stmt.run(...sqliteParams);
      return { rowCount: info.changes };
    },
  };

  return client;
}

// PostgreSQL client implementation using pg
function createPgClient(connectionString: string): DbClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });

  const client: DbClient = {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
    },
    async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const res = await this.query<T>(sql, params);
      return res.rows.length > 0 ? res.rows[0] : null;
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
      const res = await pool.query(sql, params);
      return { rowCount: res.rowCount ?? 0 };
    },
  };

  return client;
}

export function getDb(): DbClient {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL && env.DATABASE_URL.startsWith('postgres')) {
    try {
      console.log('📦 Initializing PostgreSQL connection pool...');
      dbInstance = createPgClient(env.DATABASE_URL);
      return dbInstance;
    } catch (err) {
      console.warn('⚠️ Could not connect to PostgreSQL, falling back to SQLite:', err);
    }
  }

  // SQLite fallback
  const dbDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, env.DB_FILE);
  console.log(`📦 Using secure SQLite parameterized storage: ${dbPath}`);
  dbInstance = createSqliteClient(dbPath);
  return dbInstance;
}

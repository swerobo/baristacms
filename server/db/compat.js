/**
 * Database Compatibility Layer
 *
 * Provides a synchronous-like interface for the existing server code
 * while supporting async database adapters.
 *
 * For SQLite: Uses better-sqlite3 directly (sync)
 * For Azure SQL: Would require refactoring routes to async
 */

import Database from 'better-sqlite3';

/**
 * Create a database instance based on environment
 * For now, this returns a better-sqlite3 instance for backwards compatibility
 *
 * To use Azure SQL, the server routes would need to be refactored to async
 */
export function createSyncDatabase() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const dbFile = process.env.DB_FILE || 'serverdb.db';

  if (dbType === 'azure') {
    console.warn('Azure SQL requires async routes. Falling back to SQLite for now.');
    console.warn('To use Azure SQL, refactor server routes to use async/await.');
  }

  console.log(`Using SQLite database: ${dbFile}`);
  return new Database(dbFile);
}

/**
 * Utility to check if we should use async database
 */
export function isAsyncDatabase() {
  return process.env.DB_TYPE === 'azure';
}

export default createSyncDatabase;

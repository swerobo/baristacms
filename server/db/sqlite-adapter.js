/**
 * SQLite Database Adapter
 *
 * Uses better-sqlite3 for local development.
 * Synchronous API wrapped in promises for consistency with async adapters.
 */

import Database from 'better-sqlite3';
import { DatabaseAdapter } from './interface.js';

export class SQLiteAdapter extends DatabaseAdapter {
  constructor(filename = 'serverdb.db') {
    super();
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
  }

  async all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('SQLite all() error:', error.message);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error('SQLite get() error:', error.message);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      console.error('SQLite run() error:', error.message);
      throw error;
    }
  }

  async exec(sql) {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error('SQLite exec() error:', error.message);
      throw error;
    }
  }

  async transaction(fn) {
    const transaction = this.db.transaction(fn);
    return transaction(this);
  }

  async close() {
    this.db.close();
  }

  async isConnected() {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  // Helper method for ALTER TABLE that ignores "column already exists" errors
  async safeAddColumn(table, column, definition) {
    try {
      await this.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Added column ${column} to ${table}`);
    } catch (error) {
      if (!error.message.includes('duplicate column')) {
        throw error;
      }
      // Column already exists, ignore
    }
  }
}

export default SQLiteAdapter;

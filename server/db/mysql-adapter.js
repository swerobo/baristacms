/**
 * MySQL Database Adapter
 *
 * Uses mysql2 package for MySQL/MariaDB connections.
 * Supports connection pooling for production use.
 *
 * Environment Variables:
 *   MYSQL_HOST=localhost
 *   MYSQL_PORT=3306
 *   MYSQL_DATABASE=serverdb
 *   MYSQL_USER=root
 *   MYSQL_PASSWORD=password
 *
 * Or use connection string:
 *   MYSQL_CONNECTION_STRING=mysql://user:password@host:port/database
 */

import mysql from 'mysql2/promise';
import { DatabaseAdapter } from './interface.js';

export class MySQLAdapter extends DatabaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.pool = null;
  }

  async connect() {
    console.log('MySQLAdapter.connect() - config:', JSON.stringify(this.config, null, 2));
    if (typeof this.config === 'string') {
      // Connection string
      this.pool = mysql.createPool(this.config);
    } else {
      // Config object
      const poolConfig = {
        host: this.config.host || 'localhost',
        port: this.config.port || 3306,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        // Handle MySQL's different date handling
        dateStrings: true,
      };

      // Enable SSL for Azure MySQL (detect by hostname) or if MYSQL_SSL is set
      const isAzureMySQL = poolConfig.host && poolConfig.host.includes('.mysql.database.azure.com');
      if (this.config.ssl || process.env.MYSQL_SSL === 'true' || isAzureMySQL) {
        poolConfig.ssl = {
          rejectUnauthorized: false
        };
        console.log('MySQL SSL enabled for host:', poolConfig.host);
      }

      this.pool = mysql.createPool(poolConfig);
    }

    // Test connection
    const connection = await this.pool.getConnection();
    console.log('Connected to MySQL database');
    connection.release();
  }

  async all(sql, params = []) {
    try {
      // Convert ? placeholders for compatibility (MySQL uses ? natively)
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('MySQL all() error:', error.message);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows[0] || null;
    } catch (error) {
      console.error('MySQL get() error:', error.message);
      throw error;
    }
  }

  async run(sql, params = []) {
    try {
      // Convert undefined to null for MySQL compatibility
      const safeParams = params.map(p => p === undefined ? null : p);
      console.log('MySQL run() SQL:', sql.substring(0, 100));
      console.log('MySQL run() params:', safeParams);
      const [result] = await this.pool.execute(sql, safeParams);
      console.log('MySQL run() result:', { affectedRows: result.affectedRows, insertId: result.insertId });
      return {
        changes: result.affectedRows,
        lastInsertRowid: result.insertId,
      };
    } catch (error) {
      console.error('MySQL run() error:', error.message);
      console.error('MySQL run() SQL was:', sql);
      console.error('MySQL run() params were:', params);
      throw error;
    }
  }

  /**
   * Convert SQLite syntax to MySQL syntax
   */
  convertToMySQL(sql) {
    let converted = sql;

    // Convert INTEGER PRIMARY KEY AUTOINCREMENT to INT AUTO_INCREMENT PRIMARY KEY
    converted = converted.replace(
      /(\w+)\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi,
      '$1 INT AUTO_INCREMENT PRIMARY KEY'
    );

    // Convert TEXT to VARCHAR(255) or TEXT based on context
    // For columns that are likely short strings, use VARCHAR
    converted = converted.replace(/\bTEXT\s+UNIQUE/gi, 'VARCHAR(255) UNIQUE');
    converted = converted.replace(/\bTEXT\s+NOT\s+NULL/gi, 'VARCHAR(255) NOT NULL');
    converted = converted.replace(/\bTEXT\s+DEFAULT\s+'([^']+)'/gi, "VARCHAR(255) DEFAULT '$1'");

    // Convert remaining TEXT to TEXT (MySQL supports TEXT)
    // No change needed for plain TEXT

    // Convert INTEGER DEFAULT to INT DEFAULT for boolean-like fields
    converted = converted.replace(/\bINTEGER\s+DEFAULT\s+(\d+)/gi, 'INT DEFAULT $1');
    converted = converted.replace(/\bINTEGER\s+NOT\s+NULL/gi, 'INT NOT NULL');
    converted = converted.replace(/\bINTEGER\b(?!\s+AUTO_INCREMENT)/gi, 'INT');

    // MySQL uses DATETIME, same as SQLite - no change needed

    // Convert UNIQUE constraints in column definition
    // MySQL handles UNIQUE(col1, col2) the same way

    return converted;
  }

  async exec(sql) {
    try {
      // Convert SQLite syntax to MySQL
      const mysqlSql = this.convertToMySQL(sql);

      // Split multiple statements and execute each
      const statements = mysqlSql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.pool.query(statement);
        }
      }
    } catch (error) {
      console.error('MySQL exec() error:', error.message);
      throw error;
    }
  }

  async transaction(fn) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      // Create a transaction-scoped adapter
      const txAdapter = {
        all: async (sql, params) => {
          const [rows] = await connection.execute(sql, params);
          return rows;
        },
        get: async (sql, params) => {
          const [rows] = await connection.execute(sql, params);
          return rows[0] || null;
        },
        run: async (sql, params) => {
          const [result] = await connection.execute(sql, params);
          return {
            changes: result.affectedRows,
            lastInsertRowid: result.insertId,
          };
        },
      };

      const result = await fn(txAdapter);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('MySQL connection pool closed');
    }
  }

  async isConnected() {
    try {
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch {
      return false;
    }
  }

  // Helper for schema that handles MySQL-specific syntax differences
  async safeAddColumn(table, column, definition) {
    try {
      // Check if column exists
      const [rows] = await this.pool.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );

      if (rows.length === 0) {
        await this.pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added column ${column} to ${table}`);
      }
    } catch (error) {
      console.error(`Error adding column ${column}:`, error.message);
      throw error;
    }
  }
}

export default MySQLAdapter;

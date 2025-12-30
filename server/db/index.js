/**
 * Database Factory
 *
 * Creates the appropriate database adapter based on environment configuration.
 * Uses dynamic imports to avoid loading unnecessary dependencies.
 *
 * Usage:
 *   import { createDatabase } from './db/index.js';
 *   const db = await createDatabase();
 *
 * Environment Variables:
 *   DB_TYPE=sqlite (default), azure, or mysql
 *
 * For SQLite:
 *   DB_FILE=serverdb.db
 *
 * For Azure SQL:
 *   AZURE_SQL_CONNECTION_STRING=Server=xxx.database.windows.net;Database=xxx;User Id=xxx;Password=xxx;Encrypt=true
 *   Or individual settings:
 *   AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD
 *
 * For MySQL:
 *   MYSQL_CONNECTION_STRING=mysql://user:password@host:port/database
 *   Or individual settings:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
 */

/**
 * Create and initialize the database adapter
 * Uses dynamic imports so dependencies are only loaded when needed
 * @returns {Promise<DatabaseAdapter>}
 */
export async function createDatabase() {
  const dbType = process.env.DB_TYPE || 'sqlite';

  console.log(`Initializing database with type: ${dbType}`);

  if (dbType === 'azure') {
    // Dynamic import for Azure SQL adapter
    const { AzureSQLAdapter } = await import('./azure-sql-adapter.js');

    // Azure SQL configuration
    let config;

    if (process.env.AZURE_SQL_CONNECTION_STRING) {
      // Use connection string directly
      config = process.env.AZURE_SQL_CONNECTION_STRING;
    } else {
      // Build config from individual settings
      config = {
        server: process.env.AZURE_SQL_SERVER,
        database: process.env.AZURE_SQL_DATABASE,
        user: process.env.AZURE_SQL_USER,
        password: process.env.AZURE_SQL_PASSWORD,
        options: {
          encrypt: true, // Required for Azure
          trustServerCertificate: false,
        },
      };
    }

    const adapter = new AzureSQLAdapter(config);
    await adapter.connect();
    return adapter;

  } else if (dbType === 'mysql') {
    // Dynamic import for MySQL adapter
    const { MySQLAdapter } = await import('./mysql-adapter.js');

    // MySQL configuration
    let config;

    if (process.env.MYSQL_CONNECTION_STRING) {
      // Use connection string directly
      config = process.env.MYSQL_CONNECTION_STRING;
    } else {
      // Build config from individual settings
      config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        ssl: process.env.MYSQL_SSL === 'true',
      };
    }

    const adapter = new MySQLAdapter(config);
    await adapter.connect();
    return adapter;

  } else {
    // Dynamic import for SQLite adapter (avoids loading better-sqlite3 on Azure)
    const { SQLiteAdapter } = await import('./sqlite-adapter.js');
    const dbFile = process.env.DB_FILE || 'serverdb.db';
    return new SQLiteAdapter(dbFile);
  }
}

/**
 * Get database type name for logging
 * @returns {string}
 */
export function getDatabaseType() {
  return process.env.DB_TYPE || 'sqlite';
}

export { DatabaseAdapter } from './interface.js';

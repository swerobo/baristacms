/**
 * Site Settings Routes
 * Handles global site configuration settings
 */

import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export function createSettingsRoutes(db) {
  const router = Router();

  // Get public setting (no auth required) - only specific settings are allowed
  router.get('/public/:key', async (req, res) => {
    try {
      const { key } = req.params;
      // Only allow specific public settings
      const publicSettings = ['site_name'];
      if (!publicSettings.includes(key)) {
        return res.status(403).json({ message: 'Setting not publicly accessible' });
      }

      const setting = await db.get('SELECT * FROM site_settings WHERE setting_key = ?', [key]);
      if (!setting) {
        return res.status(404).json({ message: 'Setting not found' });
      }

      res.json({ value: setting.setting_value, type: setting.setting_type });
    } catch (error) {
      console.error('Failed to get public setting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all settings
  router.get('/', async (req, res) => {
    try {
      const settings = await db.all('SELECT * FROM site_settings ORDER BY setting_key');

      // Convert to key-value object for easier frontend use
      const settingsObj = {};
      settings.forEach(s => {
        settingsObj[s.setting_key] = {
          value: s.setting_value,
          type: s.setting_type,
          description: s.description,
          updated_at: s.updated_at,
          updated_by: s.updated_by,
        };
      });

      res.json(settingsObj);
    } catch (error) {
      console.error('Failed to get settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get database info - MUST be before /:key route
  router.get('/database/info', async (req, res) => {
    try {
      const dbType = process.env.DB_TYPE || 'sqlite';
      const info = {
        type: dbType,
        database: dbType === 'mysql' ? process.env.MYSQL_DATABASE : (process.env.DB_FILE || 'serverdb.db'),
      };
      res.json(info);
    } catch (error) {
      console.error('Failed to get database info:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create database backup - MUST be before /:key route
  router.get('/database/backup', async (req, res) => {
    try {
      const dbType = process.env.DB_TYPE || 'sqlite';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (dbType === 'mysql') {
        // MySQL backup using mysqldump
        const host = process.env.MYSQL_HOST || 'localhost';
        const port = process.env.MYSQL_PORT || '3306';
        const database = process.env.MYSQL_DATABASE;
        const user = process.env.MYSQL_USER;
        const password = process.env.MYSQL_PASSWORD;

        if (!database || !user) {
          return res.status(400).json({ message: 'MySQL credentials not configured' });
        }

        const filename = `backup-${database}-${timestamp}.sql`;

        // Build mysqldump command
        let cmd = `mysqldump -h ${host} -P ${port} -u ${user}`;
        if (password) {
          cmd += ` -p${password}`;
        }
        cmd += ` ${database}`;

        try {
          const { stdout } = await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 }); // 100MB buffer

          res.setHeader('Content-Type', 'application/sql');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
          res.send(stdout);
        } catch (execError) {
          console.error('mysqldump error:', execError);
          return res.status(500).json({ message: 'Failed to create MySQL backup. Make sure mysqldump is installed.' });
        }

      } else if (dbType === 'sqlite') {
        // SQLite backup - read the database file
        const dbFile = process.env.DB_FILE || 'serverdb.db';
        const dbPath = path.resolve(dbFile);

        if (!fs.existsSync(dbPath)) {
          return res.status(404).json({ message: 'Database file not found' });
        }

        const filename = `backup-${path.basename(dbFile, '.db')}-${timestamp}.db`;

        res.setHeader('Content-Type', 'application/x-sqlite3');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        const fileStream = fs.createReadStream(dbPath);
        fileStream.pipe(res);

      } else {
        return res.status(400).json({ message: `Backup not supported for database type: ${dbType}` });
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single setting by key
  router.get('/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await db.get('SELECT * FROM site_settings WHERE setting_key = ?', [key]);

      if (!setting) {
        return res.status(404).json({ message: 'Setting not found' });
      }

      res.json(setting);
    } catch (error) {
      console.error('Failed to get setting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update or create a setting (upsert)
  router.put('/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const { value, type, description } = req.body;
      const updatedBy = req.user?.email;

      // Check if setting exists
      const existing = await db.get('SELECT * FROM site_settings WHERE setting_key = ?', [key]);

      if (existing) {
        // Update existing
        await db.run(`
          UPDATE site_settings
          SET setting_value = ?, setting_type = ?, description = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE setting_key = ?
        `, [value, type || existing.setting_type, description || existing.description, updatedBy, key]);
      } else {
        // Insert new
        await db.run(`
          INSERT INTO site_settings (setting_key, setting_value, setting_type, description, updated_by)
          VALUES (?, ?, ?, ?, ?)
        `, [key, value, type || 'string', description || null, updatedBy]);
      }

      const setting = await db.get('SELECT * FROM site_settings WHERE setting_key = ?', [key]);
      res.json(setting);
    } catch (error) {
      console.error('Failed to update setting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk update settings
  router.put('/', async (req, res) => {
    try {
      const settings = req.body;
      const updatedBy = req.user?.email;

      for (const [key, data] of Object.entries(settings)) {
        const value = typeof data === 'object' ? data.value : data;
        const type = typeof data === 'object' ? data.type : 'string';
        const description = typeof data === 'object' ? data.description : null;

        const existing = await db.get('SELECT * FROM site_settings WHERE setting_key = ?', [key]);

        if (existing) {
          await db.run(`
            UPDATE site_settings
            SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = ?
          `, [value, updatedBy, key]);
        } else {
          await db.run(`
            INSERT INTO site_settings (setting_key, setting_value, setting_type, description, updated_by)
            VALUES (?, ?, ?, ?, ?)
          `, [key, value, type, description, updatedBy]);
        }
      }

      // Return all settings
      const allSettings = await db.all('SELECT * FROM site_settings ORDER BY setting_key');
      const settingsObj = {};
      allSettings.forEach(s => {
        settingsObj[s.setting_key] = {
          value: s.setting_value,
          type: s.setting_type,
          description: s.description,
          updated_at: s.updated_at,
          updated_by: s.updated_by,
        };
      });

      res.json(settingsObj);
    } catch (error) {
      console.error('Failed to update settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a setting
  router.delete('/:key', async (req, res) => {
    try {
      const { key } = req.params;
      await db.run('DELETE FROM site_settings WHERE setting_key = ?', [key]);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete setting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createSettingsRoutes;

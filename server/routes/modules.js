/**
 * Module Routes
 * Handles module CRUD operations
 */

import { Router } from 'express';

export function createModuleRoutes(db) {
  const router = Router();

  // Get all modules
  router.get('/', async (req, res) => {
    try {
      const modules = await db.all('SELECT * FROM modules WHERE is_active = 1 ORDER BY display_name');
      modules.forEach(m => {
        if (m.config) m.config = JSON.parse(m.config);
      });
      res.json(modules);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get modules enabled for mobile app
  router.get('/app', async (req, res) => {
    try {
      const modules = await db.all('SELECT * FROM modules WHERE is_active = 1 AND use_in_app = 1 ORDER BY display_name');
      modules.forEach(m => {
        if (m.config) m.config = JSON.parse(m.config);
      });
      res.json(modules);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get module by name
  router.get('/:name', async (req, res) => {
    try {
      const module = await db.get('SELECT * FROM modules WHERE name = ?', [req.params.name]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }
      if (module.config) module.config = JSON.parse(module.config);

      // Get fields (ordered by weight, then sort_order)
      module.fields = await db.all('SELECT * FROM module_fields WHERE module_id = ? ORDER BY weight ASC, sort_order ASC', [module.id]);
      module.fields.forEach(f => {
        if (f.options) f.options = JSON.parse(f.options);
      });

      res.json(module);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create module
  router.post('/', async (req, res) => {
    try {
      const { name, displayName, description, icon, config, menuId, parentModuleId, fields } = req.body;
      if (!name || !displayName) {
        return res.status(400).json({ message: 'Name and displayName are required' });
      }

      const result = await db.run(`
        INSERT INTO modules (name, display_name, description, icon, config, menu_id, parent_module_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, displayName, description || null, icon || null, config ? JSON.stringify(config) : null, menuId || null, parentModuleId || null]);

      const moduleId = result.lastInsertRowid;

      // Always add a default "description" field (textarea) at sort_order 0, weight 50
      await db.run(`
        INSERT INTO module_fields (module_id, name, display_name, field_type, is_required, options, default_value, relation_module, warning_yellow_days, warning_red_days, warning_mode, sort_order, weight)
        VALUES (?, 'description', 'Description', 'textarea', 0, NULL, NULL, NULL, NULL, NULL, 'overdue', 0, 50)
      `, [moduleId]);

      // Add additional fields if provided (starting at sort_order 1)
      if (fields && Array.isArray(fields)) {
        for (let index = 0; index < fields.length; index++) {
          const field = fields[index];
          // Skip if user tries to add a description field (we already added it)
          if (field.name === 'description') continue;

          await db.run(`
            INSERT INTO module_fields (module_id, name, display_name, field_type, is_required, options, default_value, relation_module, warning_yellow_days, warning_red_days, warning_mode, sort_order, weight)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            moduleId,
            field.name,
            field.displayName || field.name,
            field.fieldType || 'text',
            field.isRequired ? 1 : 0,
            field.options ? JSON.stringify(field.options) : null,
            field.defaultValue || null,
            field.relationModule || null,
            field.warningYellowDays || null,
            field.warningRedDays || null,
            field.warningMode || 'overdue',
            (field.sortOrder ?? index) + 1,  // Offset by 1 since description is at 0
            field.weight ?? 50  // Default weight is 50
          ]);
        }
      }

      const module = await db.get('SELECT * FROM modules WHERE id = ?', [result.lastInsertRowid]);
      if (module.config) module.config = JSON.parse(module.config);

      // Include fields in the response (ordered by weight)
      module.fields = await db.all('SELECT * FROM module_fields WHERE module_id = ? ORDER BY weight ASC, sort_order ASC', [module.id]);
      module.fields.forEach(f => {
        if (f.options) f.options = JSON.parse(f.options);
      });

      res.status(201).json(module);
    } catch (error) {
      console.error('Error creating module:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update module
  router.put('/:name', async (req, res) => {
    try {
      const { name } = req.params;
      const { displayName, description, icon, config, menuId, parentModuleId, useInApp, fields } = req.body;

      const module = await db.get('SELECT * FROM modules WHERE name = ?', [name]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      await db.run(`
        UPDATE modules
        SET display_name = ?, description = ?, icon = ?, config = ?, menu_id = ?, parent_module_id = ?, use_in_app = ?, updated_at = CURRENT_TIMESTAMP
        WHERE name = ?
      `, [displayName, description || null, icon || null, config ? JSON.stringify(config) : null, menuId || null, parentModuleId || null, useInApp ? 1 : 0, name]);

      // Update fields if provided
      if (fields && Array.isArray(fields)) {
        // Get existing field IDs
        const existingFields = await db.all('SELECT id, name FROM module_fields WHERE module_id = ?', [module.id]);
        const existingFieldMap = new Map(existingFields.map(f => [f.name, f.id]));
        const newFieldNames = new Set(fields.map(f => f.name));

        // Delete fields that are no longer in the list
        for (const existing of existingFields) {
          if (!newFieldNames.has(existing.name)) {
            await db.run('DELETE FROM module_fields WHERE id = ?', [existing.id]);
          }
        }

        // Update or insert fields
        for (let index = 0; index < fields.length; index++) {
          const field = fields[index];
          const existingId = existingFieldMap.get(field.name);

          if (existingId) {
            // Update existing field
            await db.run(`
              UPDATE module_fields
              SET display_name = ?, field_type = ?, is_required = ?, options = ?, default_value = ?, relation_module = ?, warning_yellow_days = ?, warning_red_days = ?, warning_mode = ?, sort_order = ?, weight = ?
              WHERE id = ?
            `, [
              field.displayName || field.name,
              field.fieldType || 'text',
              field.isRequired ? 1 : 0,
              field.options ? JSON.stringify(field.options) : null,
              field.defaultValue || null,
              field.relationModule || null,
              field.warningYellowDays || null,
              field.warningRedDays || null,
              field.warningMode || 'overdue',
              field.sortOrder ?? index,
              field.weight ?? 50,
              existingId
            ]);
          } else {
            // Insert new field
            await db.run(`
              INSERT INTO module_fields (module_id, name, display_name, field_type, is_required, options, default_value, relation_module, warning_yellow_days, warning_red_days, warning_mode, sort_order, weight)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              module.id,
              field.name,
              field.displayName || field.name,
              field.fieldType || 'text',
              field.isRequired ? 1 : 0,
              field.options ? JSON.stringify(field.options) : null,
              field.defaultValue || null,
              field.relationModule || null,
              field.warningYellowDays || null,
              field.warningRedDays || null,
              field.warningMode || 'overdue',
              field.sortOrder ?? index,
              field.weight ?? 50
            ]);
          }
        }
      }

      // Return updated module
      const updatedModule = await db.get('SELECT * FROM modules WHERE name = ?', [name]);
      if (updatedModule.config) updatedModule.config = JSON.parse(updatedModule.config);

      updatedModule.fields = await db.all('SELECT * FROM module_fields WHERE module_id = ? ORDER BY weight ASC, sort_order ASC', [updatedModule.id]);
      updatedModule.fields.forEach(f => {
        if (f.options) f.options = JSON.parse(f.options);
      });

      res.json(updatedModule);
    } catch (error) {
      console.error('Error updating module:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete module
  router.delete('/:name', async (req, res) => {
    try {
      const { name } = req.params;
      await db.run('DELETE FROM modules WHERE name = ?', [name]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get sub-modules for a module
  router.get('/:name/submodules', async (req, res) => {
    try {
      const module = await db.get('SELECT id FROM modules WHERE name = ?', [req.params.name]);
      if (!module) {
        return res.status(404).json({ message: 'Module not found' });
      }

      const subModules = await db.all(
        'SELECT * FROM modules WHERE parent_module_id = ? AND is_active = 1 ORDER BY display_name',
        [module.id]
      );

      subModules.forEach(m => {
        if (m.config) m.config = JSON.parse(m.config);
      });

      res.json(subModules);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createModuleRoutes;

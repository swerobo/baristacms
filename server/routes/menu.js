/**
 * Menu Routes
 * Handles menu item management
 */

import { Router } from 'express';

// Helper function to build menu tree
function buildMenuTree(items, parentId = null) {
  return items
    .filter(item => item.parent_id === parentId)
    .map(item => ({
      ...item,
      children: buildMenuTree(items, item.id)
    }))
    .sort((a, b) => {
      // Sort by weight first (lower weight = higher priority), then by sort_order
      const weightA = a.weight ?? 50;
      const weightB = b.weight ?? 50;
      if (weightA !== weightB) return weightA - weightB;
      return a.sort_order - b.sort_order;
    });
}

export function createMenuRoutes(db) {
  const router = Router();

  // Get unread counts per module for current user
  router.get('/unread-counts', async (req, res) => {
    try {
      const email = req.user?.email;
      if (!email) {
        return res.json({});
      }

      // Get count of records per module that the user hasn't viewed
      const counts = await db.all(`
        SELECT
          m.name as module_name,
          COUNT(mr.id) as unread_count
        FROM modules m
        INNER JOIN module_records mr ON mr.module_id = m.id
        LEFT JOIN record_views rv ON rv.record_id = mr.id AND rv.user_email = ?
        WHERE m.is_active = 1 AND rv.id IS NULL
        GROUP BY m.id, m.name
      `, [email]);

      // Convert to object { moduleName: count }
      const result = {};
      for (const row of counts) {
        result[row.module_name] = row.unread_count;
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get menu for current user (filtered by role and group access) - returns tree structure
  router.get('/', async (req, res) => {
    try {
      console.log('GET /menu - request received');
      const email = req.user?.email;
      const authType = req.user?.authType || 'm365';
      let userRole = 'user';
      let userId = null;

      console.log('GET /menu - email:', email, 'authType:', authType);

      if (email) {
        // Use case-insensitive email match, filtering by auth_type for local users
        let user;
        if (authType === 'local') {
          user = await db.get("SELECT id, role FROM users WHERE LOWER(email) = LOWER(?) AND auth_type = 'local'", [email]);
        } else {
          user = await db.get('SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        }
        console.log('GET /menu - user lookup result:', user);
        if (user) {
          userRole = user.role;
          userId = user.id;
        }
      }

      console.log('GET /menu - userRole:', userRole, 'userId:', userId);

      // Get all active menu items
      let items = await db.all(`
        SELECT * FROM menu_items
        WHERE is_active = 1
        ORDER BY sort_order
      `);
      console.log('GET /menu - menu items count:', items.length, 'items:', items.map(i => i.name));

      // Get all active modules with their menu_id
      let modules = await db.all(`
        SELECT id, name, display_name, menu_id, icon, menu_weight
        FROM modules
        WHERE is_active = 1 AND menu_id IS NOT NULL
      `);

      // Filter by group access (unless user is admin)
      console.log('Menu filter - userRole:', userRole, 'userId:', userId, 'email:', email, 'authType:', authType);
      if (userRole !== 'admin' && userId) {
        // Get accessible modules
        const accessibleModules = await db.all(`
          SELECT DISTINCT gma.module_id
          FROM group_module_access gma
          INNER JOIN user_group_members ugm ON ugm.group_id = gma.group_id
          WHERE ugm.user_id = ?
        `, [userId]);
        const accessibleModuleIds = new Set(accessibleModules.map(m => m.module_id));
        console.log('Accessible module IDs for user', userId, ':', [...accessibleModuleIds]);
        console.log('Modules before filter:', modules.map(m => m.name));
        modules = modules.filter(m => accessibleModuleIds.has(m.id));
        console.log('Modules after filter:', modules.map(m => m.name));

        // Get accessible menu items
        const accessibleMenuItems = await db.all(`
          SELECT DISTINCT gma.menu_item_id
          FROM group_menu_access gma
          INNER JOIN user_group_members ugm ON ugm.group_id = gma.group_id
          WHERE ugm.user_id = ?
        `, [userId]);
        const accessibleMenuIds = new Set(accessibleMenuItems.map(m => m.menu_item_id));

        // Get menu items that have NO group restrictions (available to all)
        const restrictedMenuIds = await db.all(`SELECT DISTINCT menu_item_id FROM group_menu_access`);
        const restrictedMenuIdSet = new Set(restrictedMenuIds.map(m => m.menu_item_id));

        // Filter: keep items that are either unrestricted OR accessible through groups
        items = items.filter(item => !restrictedMenuIdSet.has(item.id) || accessibleMenuIds.has(item.id));
      }

      // Add modules as virtual menu items under their parent menu
      // Use negative IDs to avoid conflicts with real menu items
      modules.forEach(module => {
        items.push({
          id: -module.id, // Negative ID to distinguish from real menu items
          name: module.name,
          display_name: module.display_name,
          icon: module.icon || 'CubeIcon',
          path: `/records/${module.name}`,
          parent_id: module.menu_id,
          sort_order: 0,
          weight: module.menu_weight ?? 50,
          is_active: 1,
          required_role: null,
          is_module: true,
        });
      });

      // Get all published basic pages with menu assignment
      const basicPages = await db.all(`
        SELECT id, title, slug, menu_id, icon, sort_order
        FROM basic_pages
        WHERE is_published = 1 AND show_in_menu = 1 AND menu_id IS NOT NULL
      `);

      // Add basic pages as virtual menu items
      // Use IDs starting from -100000 to avoid conflicts with modules
      basicPages.forEach(page => {
        items.push({
          id: -100000 - page.id, // Negative ID to distinguish from real menu items and modules
          name: `page-${page.slug}`,
          display_name: page.title,
          icon: page.icon || 'DocumentTextIcon',
          path: `/page/${page.slug}`,
          parent_id: page.menu_id,
          sort_order: page.sort_order || 0,
          weight: 50,
          is_active: 1,
          required_role: null,
          is_page: true,
        });
      });

      // Filter items based on role
      console.log('GET /menu - filtering items. userRole:', userRole);
      const filteredItems = items.filter(item => {
        if (!item.required_role) return true;
        if (userRole === 'admin') return true;
        if (item.required_role === 'manager' && (userRole === 'manager' || userRole === 'admin')) return true;
        return item.required_role === userRole;
      });
      console.log('GET /menu - filtered items count:', filteredItems.length, 'names:', filteredItems.map(i => i.name));

      // Build tree structure
      const tree = buildMenuTree(filteredItems);
      console.log('GET /menu - returning tree with', tree.length, 'root items:', tree.map(t => t.name));
      res.json(tree);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all menu items (admin) - returns tree structure including modules
  router.get('/all', async (req, res) => {
    try {
      const items = await db.all('SELECT * FROM menu_items ORDER BY sort_order');

      // Get all modules with their menu_id to show as children
      const modules = await db.all(`
        SELECT id, name, display_name, menu_id, icon, menu_weight, is_active
        FROM modules
        WHERE menu_id IS NOT NULL
      `);

      // Add modules as virtual menu items under their parent menu
      // Use negative IDs to avoid conflicts with real menu items
      modules.forEach(module => {
        items.push({
          id: -module.id, // Negative ID to distinguish from real menu items
          name: module.name,
          display_name: module.display_name,
          icon: module.icon || 'CubeIcon',
          path: `/records/${module.name}`,
          parent_id: module.menu_id,
          sort_order: 0,
          weight: module.menu_weight ?? 50,
          is_active: module.is_active,
          required_role: null,
          is_module: true,
        });
      });

      // Get all basic pages with menu assignment (for admin view)
      const basicPages = await db.all(`
        SELECT id, title, slug, menu_id, icon, sort_order, is_published
        FROM basic_pages
        WHERE menu_id IS NOT NULL
      `);

      // Add basic pages as virtual menu items
      basicPages.forEach(page => {
        items.push({
          id: -100000 - page.id,
          name: `page-${page.slug}`,
          display_name: page.title,
          icon: page.icon || 'DocumentTextIcon',
          path: `/page/${page.slug}`,
          parent_id: page.menu_id,
          sort_order: page.sort_order || 0,
          weight: 50,
          is_active: page.is_published,
          required_role: null,
          is_page: true,
        });
      });

      const tree = buildMenuTree(items);
      res.json(tree);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single menu item with children
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
      if (!item) {
        return res.status(404).json({ message: 'Menu item not found' });
      }
      // Get children
      item.children = await db.all('SELECT * FROM menu_items WHERE parent_id = ? ORDER BY sort_order', [item.id]);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create menu item
  router.post('/', async (req, res) => {
    try {
      const { name, display_name, displayName, icon, path, parent_id, parentId, sort_order, sortOrder, weight, is_active, isActive, required_role, requiredRole } = req.body;

      const finalDisplayName = display_name || displayName;
      const finalParentId = parent_id ?? parentId ?? null;
      const finalSortOrder = sort_order ?? sortOrder ?? 0;
      const finalWeight = weight ?? 50;
      const finalIsActive = is_active ?? isActive ?? true;
      const finalRequiredRole = required_role || requiredRole || null;

      const result = await db.run(`
        INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, weight, is_active, required_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, finalDisplayName, icon || null, path || null, finalParentId, finalSortOrder, finalWeight, finalIsActive ? 1 : 0, finalRequiredRole]);

      const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [result.lastInsertRowid]);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder menu items
  router.put('/reorder', async (req, res) => {
    try {
      const { items } = req.body;

      for (const item of items) {
        await db.run(
          'UPDATE menu_items SET sort_order = ?, parent_id = ? WHERE id = ?',
          [item.sort_order, item.parent_id || null, item.id]
        );
      }

      const allItems = await db.all('SELECT * FROM menu_items ORDER BY sort_order');
      res.json(allItems);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update menu item (or module if ID is negative)
  router.put('/:id', async (req, res) => {
    console.log('PUT /menu/:id called with id:', req.params.id);
    console.log('Request body:', req.body);
    try {
      const id = parseInt(req.params.id, 10);
      const body = req.body;

      console.log('Parsed id:', id);

      // Handle module updates (negative IDs)
      if (id < 0) {
        const moduleId = Math.abs(id);
        const module = await db.get('SELECT * FROM modules WHERE id = ?', [moduleId]);
        if (!module) {
          return res.status(404).json({ message: 'Module not found' });
        }

        // Update module's menu_weight
        const newWeight = body.weight ?? module.menu_weight ?? 50;
        await db.run('UPDATE modules SET menu_weight = ? WHERE id = ?', [newWeight, moduleId]);

        // Return the updated module as a virtual menu item
        const updated = await db.get('SELECT id, name, display_name, menu_id, icon, menu_weight, is_active FROM modules WHERE id = ?', [moduleId]);
        return res.json({
          id: -updated.id,
          name: updated.name,
          display_name: updated.display_name,
          icon: updated.icon || 'CubeIcon',
          path: `/records/${updated.name}`,
          parent_id: updated.menu_id,
          sort_order: 0,
          weight: updated.menu_weight ?? 50,
          is_active: updated.is_active,
          is_module: true,
        });
      }

      // Get existing item to preserve values not being updated
      const existing = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
      console.log('Existing item:', existing);
      if (!existing) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      // Helper to check if a key exists in the request body (even if null)
      const hasKey = (key) => key in body;

      const finalDisplayName = body.display_name ?? body.displayName ?? existing.display_name;

      // For parentId: if explicitly sent (even as null), use it; otherwise keep existing
      let finalParentId = existing.parent_id;
      if (hasKey('parent_id')) {
        finalParentId = body.parent_id;
      } else if (hasKey('parentId')) {
        finalParentId = body.parentId;
      }

      const finalSortOrder = body.sort_order ?? body.sortOrder ?? existing.sort_order;
      const finalWeight = body.weight ?? existing.weight ?? 50;
      const finalIsActive = body.is_active ?? body.isActive ?? existing.is_active;
      const finalRequiredRole = hasKey('required_role') ? body.required_role :
                                (hasKey('requiredRole') ? body.requiredRole : existing.required_role);

      const params = [
        body.name ?? existing.name,
        finalDisplayName,
        hasKey('icon') ? body.icon : existing.icon,
        hasKey('path') ? body.path : existing.path,
        finalParentId,
        finalSortOrder,
        finalWeight,
        finalIsActive ? 1 : 0,
        finalRequiredRole,
        id
      ];

      console.log('Updating menu item:', id, 'with params:', params);

      const result = await db.run(`
        UPDATE menu_items
        SET name = ?, display_name = ?, icon = ?, path = ?, parent_id = ?,
            sort_order = ?, weight = ?, is_active = ?, required_role = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, params);

      console.log('Update result:', result);

      const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [id]);
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete menu item
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.run('DELETE FROM menu_items WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
}

export default createMenuRoutes;

/**
 * Database Schema Initialization
 *
 * Creates all tables and runs migrations.
 * Works with both SQLite and Azure SQL.
 */

/**
 * Initialize the database schema
 * @param {import('./interface.js').DatabaseAdapter} db
 */
export async function initializeSchema(db) {
  console.log('Initializing database schema...');

  // ============ CORE TABLES ============

  // Users table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // User permissions table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, module)
    )
  `);

  // ============ MENU TABLES ============

  // Menu items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      icon TEXT,
      path TEXT,
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      weight INTEGER DEFAULT 50,
      is_active INTEGER DEFAULT 1,
      required_role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
    )
  `);

  // ============ MODULAR SYSTEM TABLES ============

  // Modules table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      is_active INTEGER DEFAULT 1,
      config TEXT,
      menu_id INTEGER,
      parent_module_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_module_id) REFERENCES modules(id) ON DELETE SET NULL
    )
  `);

  // Module fields table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS module_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      field_type TEXT DEFAULT 'text',
      is_required INTEGER DEFAULT 0,
      options TEXT,
      default_value TEXT,
      relation_module TEXT,
      warning_yellow_days INTEGER,
      warning_red_days INTEGER,
      warning_mode TEXT DEFAULT 'overdue',
      sort_order INTEGER DEFAULT 0,
      weight INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Module records table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS module_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      data TEXT,
      thumbnail TEXT,
      parent_record_id INTEGER,
      assigned_to TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_record_id) REFERENCES module_records(id) ON DELETE CASCADE
    )
  `);

  // ============ RECORD ATTACHMENTS ============

  // Record images table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS record_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Record documents table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS record_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Record history/activity log table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS record_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      description TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      user_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // Record links table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS record_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // ============ SITE SETTINGS TABLE ============

  await db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      setting_type TEXT DEFAULT 'string',
      description TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============ PRINT QUEUE TABLE ============

  await db.exec(`
    CREATE TABLE IF NOT EXISTS print_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      module_name TEXT NOT NULL,
      record_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      printed_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // ============ PROCESSED EMAILS TABLE ============

  await db.exec(`
    CREATE TABLE IF NOT EXISTS processed_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id TEXT UNIQUE NOT NULL,
      module_id INTEGER,
      record_id INTEGER,
      from_address TEXT,
      from_name TEXT,
      subject TEXT,
      body_preview TEXT,
      received_at DATETIME,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processed',
      error_message TEXT,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE SET NULL
    )
  `);

  // ============ RECORD VIEWS TABLE ============
  // Tracks which records have been viewed by which user

  await db.exec(`
    CREATE TABLE IF NOT EXISTS record_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES module_records(id) ON DELETE CASCADE,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
      UNIQUE(record_id, user_email)
    )
  `);

  // ============ PAGE TEMPLATES TABLE ============
  // Quick add form pages linked to modules

  await db.exec(`
    CREATE TABLE IF NOT EXISTS page_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      fields TEXT,
      default_values TEXT,
      success_message TEXT,
      is_active INTEGER DEFAULT 1,
      require_auth INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // ============ DASHBOARDS TABLE ============
  // Dashboard configurations linked to modules

  await db.exec(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      widgets TEXT,
      date_range_default TEXT DEFAULT '30',
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
    )
  `);

  // ============ BASIC PAGES TABLE ============
  // Static content pages (Start, Documentation, Tips, FAQ, etc.)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS basic_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      menu_id INTEGER,
      page_type TEXT DEFAULT 'content',
      is_published INTEGER DEFAULT 0,
      show_in_menu INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      icon TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (menu_id) REFERENCES menu_items(id) ON DELETE SET NULL
    )
  `);

  // Run migrations for existing databases
  await runMigrations(db);

  console.log('Database schema initialized successfully');
}

/**
 * Run database migrations for schema updates
 * @param {import('./interface.js').DatabaseAdapter} db
 */
async function runMigrations(db) {
  // Add any columns that might be missing in existing databases
  if (db.safeAddColumn) {
    await db.safeAddColumn('modules', 'menu_id', 'INTEGER REFERENCES menu_items(id) ON DELETE SET NULL');
    await db.safeAddColumn('modules', 'parent_module_id', 'INTEGER REFERENCES modules(id) ON DELETE SET NULL');
    await db.safeAddColumn('module_fields', 'relation_module', 'TEXT');
    await db.safeAddColumn('module_fields', 'warning_yellow_days', 'INTEGER');
    await db.safeAddColumn('module_fields', 'warning_red_days', 'INTEGER');
    await db.safeAddColumn('module_fields', 'warning_mode', "TEXT DEFAULT 'overdue'");
    await db.safeAddColumn('module_fields', 'weight', 'INTEGER DEFAULT 50');
    await db.safeAddColumn('module_records', 'parent_record_id', 'INTEGER REFERENCES module_records(id) ON DELETE CASCADE');
    await db.safeAddColumn('module_records', 'assigned_to', 'TEXT');
    await db.safeAddColumn('menu_items', 'weight', 'INTEGER DEFAULT 50');
    await db.safeAddColumn('modules', 'menu_weight', 'INTEGER DEFAULT 50');
    await db.safeAddColumn('dashboards', 'require_auth', 'INTEGER DEFAULT 1');
    await db.safeAddColumn('dashboards', 'layout', 'TEXT');
    await db.safeAddColumn('modules', 'use_in_app', 'INTEGER DEFAULT 0');
  }

  // Migration: Change record_links.url to LONGTEXT for MySQL to handle long URLs
  try {
    await db.exec('ALTER TABLE record_links MODIFY COLUMN url LONGTEXT NOT NULL');
    console.log('Migration: record_links.url changed to LONGTEXT');
  } catch (error) {
    // Ignore error - column might already be correct type or using SQLite
    if (!error.message.includes('syntax') && !error.message.includes('MODIFY')) {
      console.log('Migration note: record_links.url column type unchanged');
    }
  }

  // Migration: Add Pages menu item if it doesn't exist
  try {
    const pagesMenuItem = await db.get("SELECT id FROM menu_items WHERE name = 'pages'");
    if (!pagesMenuItem) {
      // Find the Administration menu item
      const adminMenu = await db.get("SELECT id FROM menu_items WHERE name = 'administration'");
      if (adminMenu) {
        await db.run(`
          INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
          VALUES ('pages', 'Pages', 'DocumentPlusIcon', '/admin/pages', ?, 2, 1, 'admin')
        `, [adminMenu.id]);
        console.log('Migration: Added Pages menu item');
      }
    }
  } catch (error) {
    console.log('Migration note: Pages menu item check failed:', error.message);
  }

  // Migration: Add Dashboards menu item if it doesn't exist
  try {
    const dashboardsMenuItem = await db.get("SELECT id FROM menu_items WHERE name = 'dashboards'");
    if (!dashboardsMenuItem) {
      // Find the Administration menu item
      const adminMenu = await db.get("SELECT id FROM menu_items WHERE name = 'administration'");
      if (adminMenu) {
        await db.run(`
          INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
          VALUES ('dashboards', 'Dashboards', 'ChartBarIcon', '/admin/dashboards', ?, 3, 1, 'admin')
        `, [adminMenu.id]);
        console.log('Migration: Added Dashboards menu item');
      }
    }
  } catch (error) {
    console.log('Migration note: Dashboards menu item check failed:', error.message);
  }

  // Migration: Add Basic Pages menu item if it doesn't exist
  try {
    const basicPagesMenuItem = await db.get("SELECT id FROM menu_items WHERE name = 'basic-pages'");
    if (!basicPagesMenuItem) {
      // Find the Administration menu item
      const adminMenu = await db.get("SELECT id FROM menu_items WHERE name = 'administration'");
      if (adminMenu) {
        await db.run(`
          INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
          VALUES ('basic-pages', 'Basic Pages', 'DocumentTextIcon', '/admin/basic-pages', ?, 5, 1, 'admin')
        `, [adminMenu.id]);
        console.log('Migration: Added Basic Pages menu item');
      }
    }
  } catch (error) {
    console.log('Migration note: Basic Pages menu item check failed:', error.message);
  }
}

/**
 * Seed default data if tables are empty
 * @param {import('./interface.js').DatabaseAdapter} db
 */
export async function seedDefaultData(db) {
  // Check if menu items exist
  const menuCount = await db.get('SELECT COUNT(*) as count FROM menu_items');
  if (menuCount && menuCount.count === 0) {
    console.log('Seeding default menu items...');

    // Administration menu group
    const adminResult = await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('administration', 'Administration', 'ShieldCheckIcon', NULL, NULL, 0, 1, 'admin')
    `);
    const adminId = adminResult.lastInsertRowid;

    // Administration sub-items
    await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('modules', 'Modules', 'Squares2X2Icon', '/admin/modules', ?, 0, 1, 'admin')
    `, [adminId]);

    await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('menu', 'Menu', 'Squares2X2Icon', '/admin/menu', ?, 1, 1, 'admin')
    `, [adminId]);

    await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('pages', 'Pages', 'DocumentPlusIcon', '/admin/pages', ?, 2, 1, 'admin')
    `, [adminId]);

    await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('users', 'Users', 'UsersIcon', '/admin/users', ?, 3, 1, 'admin')
    `, [adminId]);

    await db.run(`
      INSERT INTO menu_items (name, display_name, icon, path, parent_id, sort_order, is_active, required_role)
      VALUES ('settings', 'Settings', 'Cog6ToothIcon', '/admin/settings', ?, 4, 1, 'admin')
    `, [adminId]);

    console.log('Default menu items seeded successfully');
  }

  // Add default email settings if not exist
  const emailIntervalSetting = await db.get(
    "SELECT * FROM site_settings WHERE setting_key = 'email_check_interval_minutes'"
  );
  if (!emailIntervalSetting) {
    await db.run(`
      INSERT INTO site_settings (setting_key, setting_value, setting_type, description)
      VALUES ('email_check_interval_minutes', '0', 'number', 'Interval in minutes to check for new emails (0 = disabled)')
    `);
    console.log('Default email check interval setting added');
  }

  // Add default debug setting if not exist
  const debugSetting = await db.get(
    "SELECT * FROM site_settings WHERE setting_key = 'enable_debug_logging'"
  );
  if (!debugSetting) {
    await db.run(`
      INSERT INTO site_settings (setting_key, setting_value, setting_type, description)
      VALUES ('enable_debug_logging', 'false', 'boolean', 'Enable verbose debug logging in server console')
    `);
    console.log('Default debug logging setting added');
  }
}

export default { initializeSchema, seedDefaultData };

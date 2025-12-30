/**
 * My Server
 *
 * Main entry point for the API server.
 * Supports both SQLite (development) and Azure SQL (production).
 *
 * Environment Variables:
 *   DB_TYPE=sqlite (default) or DB_TYPE=azure
 *   DB_FILE=myserver.db (for SQLite)
 *   AZURE_SQL_CONNECTION_STRING=... (for Azure SQL)
 *   PORT=3001 (default)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authenticateWithBypass } from './auth.js';
import { createDatabase, getDatabaseType } from './db/index.js';
import { initializeSchema, seedDefaultData } from './db/schema.js';

// Route imports
import { createUserRoutes } from './routes/users.js';
import { createMenuRoutes } from './routes/menu.js';
import { createModuleRoutes } from './routes/modules.js';
import { createRecordRoutes } from './routes/records.js';
import { createEmailRoutes } from './routes/email.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createPrintQueueRoutes } from './routes/printQueue.js';
import { createPageTemplateRoutes } from './routes/pageTemplates.js';
import { createDashboardRoutes } from './routes/dashboards.js';
import { createBasicPagesRoutes } from './routes/basic-pages.js';
import { startEmailProcessor } from './services/emailProcessor.js';
import emailInboxRoutes from './routes/emailInbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory
const uploadsDir = join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// CORS configuration - allow all origins
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Email', 'X-User-Name'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: getDatabaseType(),
  });
});

// Public settings endpoint (no auth required) - defined before auth middleware
// Will be properly configured after database connection in startServer()
let publicSettingsHandler = (req, res) => res.status(503).json({ message: 'Server starting...' });
app.get('/api/settings/public/:key', (req, res) => publicSettingsHandler(req, res));

// Apply authentication to all /api routes (except health check and public settings)
app.use('/api', authenticateWithBypass);

// Initialize database and start server
async function startServer() {
  try {
    console.log('Starting Officetool server...');

    // Create database connection
    const db = await createDatabase();
    console.log(`Connected to ${getDatabaseType()} database`);

    // Initialize schema
    await initializeSchema(db);
    await seedDefaultData(db);

    // Store db and uploadsDir in app.locals for routes that need it
    app.locals.db = db;
    app.locals.uploadsDir = uploadsDir;

    // Configure public settings handler now that db is available
    publicSettingsHandler = async (req, res) => {
      try {
        const { key } = req.params;
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
        res.status(500).json({ message: error.message });
      }
    };

    // Mount routes
    app.use('/api/users', createUserRoutes(db));
    app.use('/api/permissions', createUserRoutes(db)); // For /api/permissions/check
    app.use('/api/menu', createMenuRoutes(db));
    app.use('/api/modules', createModuleRoutes(db));
    app.use('/api/m/:moduleName/records', (req, res, next) => {
      req.params.moduleName = req.params.moduleName;
      next();
    }, createRecordRoutes(db, uploadsDir));
    app.use('/api/email', createEmailRoutes());
    app.use('/api/settings', createSettingsRoutes(db));
    app.use('/api/print-queue', createPrintQueueRoutes(db));
    app.use('/api/page-templates', createPageTemplateRoutes(db));
    app.use('/api/dashboards', createDashboardRoutes(db));
    app.use('/api/basic-pages', createBasicPagesRoutes(db, uploadsDir));
    app.use('/api/email-inbox', emailInboxRoutes);

    // Start email processor if configured
    const emailIntervalSetting = await db.get(
      "SELECT setting_value FROM site_settings WHERE setting_key = 'email_check_interval_minutes'"
    );
    const emailInterval = emailIntervalSetting ? parseInt(emailIntervalSetting.setting_value, 10) : 0;
    if (emailInterval > 0) {
      startEmailProcessor(db, uploadsDir, emailInterval);
    }

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database type: ${getDatabaseType()}`);
      console.log(`API: http://localhost:${PORT}/api`);
      if (emailInterval > 0) {
        console.log(`Email processor: checking every ${emailInterval} minute(s)`);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      await db.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

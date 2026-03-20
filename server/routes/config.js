/**
 * System Configuration Routes
 * E-020: PingAM connection settings, sync intervals, retention policies
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { getDatabase } = require('../database/init');
const { AppError } = require('../middleware/errorHandler');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Configuration categories
 */
const CONFIG_CATEGORIES = {
  PINGAM: 'pingam',
  SYNC: 'sync',
  RETENTION: 'retention',
  NOTIFICATIONS: 'notifications',
  SECURITY: 'security',
  GENERAL: 'general'
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  // PingAM Connection Settings
  'pingam.url': '',
  'pingam.realm': '/alpha',
  'pingam.admin_username': '',
  'pingam.connection_timeout': 30000,
  'pingam.retry_attempts': 3,
  'pingam.verify_ssl': true,
  
  // Sync Settings
  'sync.enabled': true,
  'sync.interval_seconds': 300,
  'sync.batch_size': 1000,
  'sync.max_events_per_sync': 10000,
  'sync.last_sync_timestamp': null,
  
  // Retention Settings
  'retention.auth_events_days': 90,
  'retention.sessions_days': 30,
  'retention.api_logs_days': 14,
  'retention.alerts_days': 180,
  'retention.metrics_days': 365,
  'retention.cleanup_enabled': true,
  'retention.cleanup_hour': 2,
  
  // Notification Settings
  'notifications.email_enabled': false,
  'notifications.webhook_enabled': false,
  'notifications.webhook_url': '',
  'notifications.alert_threshold_critical': 1,
  'notifications.alert_threshold_warning': 5,
  
  // Security Settings
  'security.session_timeout_minutes': 60,
  'security.max_login_attempts': 5,
  'security.lockout_duration_minutes': 15,
  'security.require_mfa': false,
  
  // General Settings
  'general.app_name': 'PingAM Analytics Dashboard',
  'general.timezone': 'UTC',
  'general.date_format': 'YYYY-MM-DD HH:mm:ss',
  'general.items_per_page': 25
};

/**
 * Sensitive config keys that should be masked in responses
 */
const SENSITIVE_KEYS = [
  'pingam.admin_password',
  'pingam.api_key',
  'notifications.webhook_secret'
];

/**
 * Mask sensitive value
 */
function maskSensitive(key, value) {
  if (SENSITIVE_KEYS.some(k => key.includes(k))) {
    return value ? '********' : '';
  }
  return value;
}

/**
 * GET /config
 * Get all configuration settings
 */
router.get('/',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.OPERATOR]),
  async (req, res, next) => {
    try {
      const { category } = req.query;
      const db = getDatabase();

      let whereClause = '1=1';
      const params = [];

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      const configs = db.prepare(`
        SELECT config_key, config_value, category, description, updated_at, updated_by
        FROM system_config
        WHERE ${whereClause}
        ORDER BY category, config_key
      `).all(...params);

      // Merge with defaults and mask sensitive values
      const result = {};
      
      // Start with defaults
      for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
        const cat = key.split('.')[0];
        if (!category || cat === category) {
          if (!result[cat]) result[cat] = {};
          result[cat][key] = {
            value: value,
            isDefault: true
          };
        }
      }

      // Override with database values
      for (const config of configs) {
        const cat = config.category;
        if (!result[cat]) result[cat] = {};
        result[cat][config.config_key] = {
          value: maskSensitive(config.config_key, config.config_value),
          description: config.description,
          updatedAt: config.updated_at,
          updatedBy: config.updated_by,
          isDefault: false
        };
      }

      res.json({
        success: true,
        data: {
          config: result,
          categories: Object.values(CONFIG_CATEGORIES)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /config/:key
 * Get specific configuration value
 */
router.get('/:key',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.OPERATOR]),
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const db = getDatabase();

      const config = db.prepare(`
        SELECT config_key, config_value, category, description, updated_at, updated_by
        FROM system_config
        WHERE config_key = ?
      `).get(key);

      if (!config) {
        // Check if it's a default config
        if (DEFAULT_CONFIG.hasOwnProperty(key)) {
          return res.json({
            success: true,
            data: {
              key,
              value: DEFAULT_CONFIG[key],
              isDefault: true
            }
          });
        }
        throw new AppError('Configuration not found', 404, 'CONFIG_NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          key: config.config_key,
          value: maskSensitive(config.config_key, config.config_value),
          category: config.category,
          description: config.description,
          updatedAt: config.updated_at,
          updatedBy: config.updated_by,
          isDefault: false
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /config
 * Update multiple configuration settings
 */
router.put('/',
  authenticate,
  authorize(ROLES.ADMIN),
  [
    body('settings').isObject().withMessage('Settings must be an object')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { settings } = req.body;
      const db = getDatabase();

      const upsertStmt = db.prepare(`
        INSERT INTO system_config (config_id, config_key, config_value, category, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(config_key) DO UPDATE SET
          config_value = excluded.config_value,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = excluded.updated_by
      `);

      const updatedKeys = [];
      const transaction = db.transaction(() => {
        for (const [key, value] of Object.entries(settings)) {
          const category = key.split('.')[0];
          const configId = uuidv4();
          upsertStmt.run(configId, key, JSON.stringify(value), category, req.user.username);
          updatedKeys.push(key);
        }
      });

      transaction();

      logger.info('Configuration updated', { 
        updatedKeys, 
        updatedBy: req.user.username 
      });

      res.json({
        success: true,
        data: {
          message: 'Configuration updated successfully',
          updatedKeys
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /config/:key
 * Update specific configuration value
 */
router.put('/:key',
  authenticate,
  authorize(ROLES.ADMIN),
  [
    body('value').exists().withMessage('Value is required'),
    body('description').optional().isString()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      }

      const { key } = req.params;
      const { value, description } = req.body;
      const category = key.split('.')[0];
      const db = getDatabase();

      const configId = uuidv4();
      db.prepare(`
        INSERT INTO system_config (config_id, config_key, config_value, category, description, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(config_key) DO UPDATE SET
          config_value = excluded.config_value,
          description = COALESCE(excluded.description, description),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = excluded.updated_by
      `).run(configId, key, JSON.stringify(value), category, description || null, req.user.username);

      logger.info('Configuration key updated', { 
        key, 
        updatedBy: req.user.username 
      });

      res.json({
        success: true,
        data: {
          message: 'Configuration updated successfully',
          key,
          value: maskSensitive(key, value)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /config/:key
 * Reset configuration to default
 */
router.delete('/:key',
  authenticate,
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const { key } = req.params;
      const db = getDatabase();

      const result = db.prepare('DELETE FROM system_config WHERE config_key = ?').run(key);

      if (result.changes === 0) {
        throw new AppError('Configuration not found', 404, 'CONFIG_NOT_FOUND');
      }

      logger.info('Configuration reset to default', { 
        key, 
        resetBy: req.user.username 
      });

      res.json({
        success: true,
        data: {
          message: 'Configuration reset to default',
          key,
          defaultValue: DEFAULT_CONFIG[key] ?? null
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /config/pingam/test
 * Test PingAM connection
 */
router.get('/pingam/test',
  authenticate,
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      const db = getDatabase();

      // Get PingAM configuration
      const configs = db.prepare(`
        SELECT config_key, config_value
        FROM system_config
        WHERE category = 'pingam'
      `).all();

      const pingamConfig = {};
      for (const c of configs) {
        pingamConfig[c.config_key] = JSON.parse(c.config_value);
      }

      const url = pingamConfig['pingam.url'];
      if (!url) {
        throw new AppError('PingAM URL not configured', 400, 'PINGAM_NOT_CONFIGURED');
      }

      // Test connection (basic health check)
      const https = require('https');
      const http = require('http');
      const protocol = url.startsWith('https') ? https : http;

      const testConnection = () => {
        return new Promise((resolve, reject) => {
          const timeout = pingamConfig['pingam.connection_timeout'] || 30000;
          const req = protocol.get(`${url}/json/serverinfo/*`, { timeout }, (response) => {
            resolve({
              status: response.statusCode,
              reachable: true
            });
          });
          req.on('error', (err) => {
            reject(err);
          });
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Connection timeout'));
          });
        });
      };

      try {
        const result = await testConnection();
        res.json({
          success: true,
          data: {
            connected: true,
            status: result.status,
            url,
            message: 'Connection successful'
          }
        });
      } catch (connError) {
        res.json({
          success: true,
          data: {
            connected: false,
            url,
            error: connError.message,
            message: 'Connection failed'
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /config/sync/trigger
 * Manually trigger a sync with PingAM
 */
router.post('/sync/trigger',
  authenticate,
  authorize(ROLES.ADMIN),
  async (req, res, next) => {
    try {
      // This would trigger the sync service
      // For now, we'll just log and return a message
      logger.info('Manual sync triggered', { triggeredBy: req.user.username });

      res.json({
        success: true,
        data: {
          message: 'Sync triggered successfully',
          triggeredBy: req.user.username,
          triggeredAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /config/sync/status
 * Get current sync status
 */
router.get('/sync/status',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.OPERATOR]),
  async (req, res, next) => {
    try {
      const db = getDatabase();

      const lastSync = db.prepare(`
        SELECT config_value FROM system_config WHERE config_key = 'sync.last_sync_timestamp'
      `).get();

      const syncEnabled = db.prepare(`
        SELECT config_value FROM system_config WHERE config_key = 'sync.enabled'
      `).get();

      res.json({
        success: true,
        data: {
          enabled: syncEnabled ? JSON.parse(syncEnabled.config_value) : DEFAULT_CONFIG['sync.enabled'],
          lastSyncAt: lastSync ? JSON.parse(lastSync.config_value) : null,
          intervalSeconds: DEFAULT_CONFIG['sync.interval_seconds']
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
module.exports.CONFIG_CATEGORIES = CONFIG_CATEGORIES;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;

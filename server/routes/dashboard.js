/**
 * Dashboard Configuration API Routes
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * GET /dashboard/configs
 * List all dashboard configurations
 */
router.get('/configs', (req, res, next) => {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, config_id, name, description, is_default, created_by, created_at, updated_at
      FROM dashboard_configs
      ORDER BY is_default DESC, name ASC
    `);
    const configs = stmt.all();

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard/configs/default
 * Get default dashboard configuration
 */
router.get('/configs/default', (req, res, next) => {
  try {
    const db = getDatabase();
    let config = db.prepare(`
      SELECT * FROM dashboard_configs WHERE is_default = 1
    `).get();

    // If no default, return a standard config
    if (!config) {
      config = {
        config_id: 'default',
        name: 'Default Dashboard',
        config_json: JSON.stringify(getDefaultDashboardConfig())
      };
    } else {
      config.config_json = JSON.parse(config.config_json);
    }

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard/configs/:id
 * Get specific dashboard configuration
 */
router.get('/configs/:id',
  [param('id').notEmpty()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM dashboard_configs WHERE config_id = ?');
      const config = stmt.get(req.params.id);

      if (!config) {
        throw new AppError('Dashboard configuration not found', 404, 'NOT_FOUND');
      }

      config.config_json = JSON.parse(config.config_json);

      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /dashboard/configs
 * Create new dashboard configuration
 */
router.post('/configs',
  [
    body('name').notEmpty().isString().isLength({ max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('config').isObject(),
    body('is_default').optional().isBoolean(),
    body('created_by').optional().isString()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const configId = uuidv4();

      // If setting as default, unset other defaults
      if (req.body.is_default) {
        db.prepare('UPDATE dashboard_configs SET is_default = 0').run();
      }

      const stmt = db.prepare(`
        INSERT INTO dashboard_configs (
          config_id, name, description, config_json, is_default, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        configId,
        req.body.name,
        req.body.description || null,
        JSON.stringify(req.body.config),
        req.body.is_default ? 1 : 0,
        req.body.created_by || null
      );

      logger.info('Dashboard config created', { configId, name: req.body.name });

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid, config_id: configId }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /dashboard/configs/:id
 * Update dashboard configuration
 */
router.put('/configs/:id',
  [
    param('id').notEmpty(),
    body('name').optional().isString().isLength({ max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('config').optional().isObject(),
    body('is_default').optional().isBoolean()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();

      // Check if config exists
      const existing = db.prepare('SELECT id FROM dashboard_configs WHERE config_id = ?').get(req.params.id);
      if (!existing) {
        throw new AppError('Dashboard configuration not found', 404, 'NOT_FOUND');
      }

      // If setting as default, unset other defaults
      if (req.body.is_default) {
        db.prepare('UPDATE dashboard_configs SET is_default = 0').run();
      }

      const updates = [];
      const params = [];

      if (req.body.name) {
        updates.push('name = ?');
        params.push(req.body.name);
      }
      if (req.body.description !== undefined) {
        updates.push('description = ?');
        params.push(req.body.description);
      }
      if (req.body.config) {
        updates.push('config_json = ?');
        params.push(JSON.stringify(req.body.config));
      }
      if (req.body.is_default !== undefined) {
        updates.push('is_default = ?');
        params.push(req.body.is_default ? 1 : 0);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);

      const stmt = db.prepare(`
        UPDATE dashboard_configs 
        SET ${updates.join(', ')}
        WHERE config_id = ?
      `);
      stmt.run(...params);

      logger.info('Dashboard config updated', { configId: req.params.id });

      res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /dashboard/configs/:id
 * Delete dashboard configuration
 */
router.delete('/configs/:id',
  [param('id').notEmpty()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('DELETE FROM dashboard_configs WHERE config_id = ?');
      const result = stmt.run(req.params.id);

      if (result.changes === 0) {
        throw new AppError('Dashboard configuration not found', 404, 'NOT_FOUND');
      }

      logger.info('Dashboard config deleted', { configId: req.params.id });

      res.json({ success: true, message: 'Configuration deleted' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get default dashboard configuration
 */
function getDefaultDashboardConfig() {
  return {
    layout: [
      { id: 'overview-stats', x: 0, y: 0, w: 12, h: 2, component: 'OverviewStats' },
      { id: 'auth-trends', x: 0, y: 2, w: 8, h: 4, component: 'AuthTrendsChart' },
      { id: 'active-alerts', x: 8, y: 2, w: 4, h: 4, component: 'ActiveAlerts' },
      { id: 'top-users', x: 0, y: 6, w: 6, h: 4, component: 'TopUsersTable' },
      { id: 'by-application', x: 6, y: 6, w: 6, h: 4, component: 'ByApplicationChart' },
      { id: 'failure-analysis', x: 0, y: 10, w: 12, h: 4, component: 'FailureAnalysis' }
    ],
    refreshInterval: 30000,
    theme: 'light',
    dateRange: '24h'
  };
}

module.exports = router;

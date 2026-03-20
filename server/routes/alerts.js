/**
 * Alerts API Routes
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
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
 * GET /alerts
 * List alerts with filtering
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['active', 'acknowledged', 'resolved']),
    query('severity').optional().isIn(['info', 'warning', 'critical']),
    query('alert_type').optional().isString()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const params = [];

      if (req.query.status) {
        whereClause += ' AND status = ?';
        params.push(req.query.status);
      }

      if (req.query.severity) {
        whereClause += ' AND severity = ?';
        params.push(req.query.severity);
      }

      if (req.query.alert_type) {
        whereClause += ' AND alert_type = ?';
        params.push(req.query.alert_type);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM alerts WHERE ${whereClause}`);
      const { total } = countStmt.get(...params);

      const dataStmt = db.prepare(`
        SELECT * FROM alerts 
        WHERE ${whereClause}
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'warning' THEN 2 
            ELSE 3 
          END,
          triggered_at DESC
        LIMIT ? OFFSET ?
      `);
      const alerts = dataStmt.all(...params, limit, offset);

      res.json({
        success: true,
        data: alerts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /alerts/active
 * Get active alerts summary
 */
router.get('/active', (req, res, next) => {
  try {
    const db = getDatabase();
    
    const alerts = db.prepare(`
      SELECT * FROM alerts 
      WHERE status = 'active'
      ORDER BY 
        CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        triggered_at DESC
    `).all();

    const summary = db.prepare(`
      SELECT 
        severity,
        COUNT(*) as count
      FROM alerts
      WHERE status = 'active'
      GROUP BY severity
    `).all();

    res.json({
      success: true,
      data: {
        alerts,
        summary: summary.reduce((acc, s) => ({ ...acc, [s.severity]: s.count }), {}),
        total: alerts.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /alerts/:id
 * Get single alert
 */
router.get('/:id',
  [param('id').isInt().toInt()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM alerts WHERE id = ?');
      const alert = stmt.get(req.params.id);

      if (!alert) {
        throw new AppError('Alert not found', 404, 'NOT_FOUND');
      }

      res.json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /alerts
 * Create new alert
 */
router.post('/',
  [
    body('alert_type').notEmpty().isString(),
    body('severity').isIn(['info', 'warning', 'critical']),
    body('title').notEmpty().isString().isLength({ max: 255 }),
    body('description').optional().isString(),
    body('source').optional().isString(),
    body('metadata').optional().isObject()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const alertId = uuidv4();

      const stmt = db.prepare(`
        INSERT INTO alerts (
          alert_id, alert_type, severity, title, description, source, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        alertId,
        req.body.alert_type,
        req.body.severity,
        req.body.title,
        req.body.description || null,
        req.body.source || null,
        req.body.metadata ? JSON.stringify(req.body.metadata) : null
      );

      logger.warn('Alert created', { 
        alertId, 
        type: req.body.alert_type, 
        severity: req.body.severity,
        title: req.body.title
      });

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid, alert_id: alertId }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.patch('/:id/acknowledge',
  [
    param('id').isInt().toInt(),
    body('acknowledged_by').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE alerts 
        SET status = 'acknowledged', 
            acknowledged_at = CURRENT_TIMESTAMP,
            acknowledged_by = ?
        WHERE id = ? AND status = 'active'
      `);
      
      const result = stmt.run(req.body.acknowledged_by, req.params.id);

      if (result.changes === 0) {
        throw new AppError('Alert not found or not active', 404, 'NOT_FOUND');
      }

      logger.info('Alert acknowledged', { 
        alertId: req.params.id, 
        by: req.body.acknowledged_by 
      });

      res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /alerts/:id/resolve
 * Resolve an alert
 */
router.patch('/:id/resolve',
  [
    param('id').isInt().toInt(),
    body('resolved_by').notEmpty().isString()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE alerts 
        SET status = 'resolved', 
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = ?
        WHERE id = ? AND status IN ('active', 'acknowledged')
      `);
      
      const result = stmt.run(req.body.resolved_by, req.params.id);

      if (result.changes === 0) {
        throw new AppError('Alert not found or already resolved', 404, 'NOT_FOUND');
      }

      logger.info('Alert resolved', { 
        alertId: req.params.id, 
        by: req.body.resolved_by 
      });

      res.json({ success: true, message: 'Alert resolved' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

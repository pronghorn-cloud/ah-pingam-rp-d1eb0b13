/**
 * Authentication Events API Routes
 */

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../database/init');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * GET /auth-events
 * List authentication events with filtering and pagination
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['success', 'failure', 'pending']),
    query('event_type').optional().isString(),
    query('user_id').optional().isString(),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601()
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

      if (req.query.event_type) {
        whereClause += ' AND event_type = ?';
        params.push(req.query.event_type);
      }

      if (req.query.user_id) {
        whereClause += ' AND user_id = ?';
        params.push(req.query.user_id);
      }

      if (req.query.start_date) {
        whereClause += ' AND timestamp >= ?';
        params.push(req.query.start_date);
      }

      if (req.query.end_date) {
        whereClause += ' AND timestamp <= ?';
        params.push(req.query.end_date);
      }

      // Get total count
      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM auth_events WHERE ${whereClause}`);
      const { total } = countStmt.get(...params);

      // Get paginated results
      const dataStmt = db.prepare(`
        SELECT * FROM auth_events 
        WHERE ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);
      const events = dataStmt.all(...params, limit, offset);

      res.json({
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /auth-events/:id
 * Get single authentication event by ID
 */
router.get('/:id',
  [param('id').isInt().toInt()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM auth_events WHERE id = ?');
      const event = stmt.get(req.params.id);

      if (!event) {
        throw new AppError('Authentication event not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth-events
 * Create new authentication event
 */
router.post('/',
  [
    body('event_type').notEmpty().isString(),
    body('status').isIn(['success', 'failure', 'pending']),
    body('user_id').optional().isString(),
    body('username').optional().isString(),
    body('client_ip').optional().isIP(),
    body('user_agent').optional().isString(),
    body('realm').optional().isString(),
    body('application').optional().isString(),
    body('session_id').optional().isString(),
    body('duration_ms').optional().isInt({ min: 0 }),
    body('metadata').optional().isObject()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const eventId = uuidv4();

      const stmt = db.prepare(`
        INSERT INTO auth_events (
          event_id, event_type, user_id, username, client_ip, user_agent,
          realm, application, status, error_code, error_message,
          session_id, duration_ms, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        eventId,
        req.body.event_type,
        req.body.user_id || null,
        req.body.username || null,
        req.body.client_ip || req.ip,
        req.body.user_agent || req.get('User-Agent'),
        req.body.realm || null,
        req.body.application || null,
        req.body.status,
        req.body.error_code || null,
        req.body.error_message || null,
        req.body.session_id || null,
        req.body.duration_ms || null,
        req.body.metadata ? JSON.stringify(req.body.metadata) : null
      );

      logger.info('Authentication event created', { eventId, type: req.body.event_type });

      res.status(201).json({
        success: true,
        data: {
          id: result.lastInsertRowid,
          event_id: eventId
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /auth-events/bulk
 * Bulk insert authentication events
 */
router.post('/bulk',
  [
    body('events').isArray({ min: 1, max: 1000 }),
    body('events.*.event_type').notEmpty().isString(),
    body('events.*.status').isIn(['success', 'failure', 'pending'])
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const events = req.body.events;

      const stmt = db.prepare(`
        INSERT INTO auth_events (
          event_id, event_type, user_id, username, client_ip, user_agent,
          realm, application, status, error_code, error_message,
          session_id, duration_ms, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((events) => {
        const inserted = [];
        for (const event of events) {
          const eventId = uuidv4();
          stmt.run(
            eventId,
            event.event_type,
            event.user_id || null,
            event.username || null,
            event.client_ip || null,
            event.user_agent || null,
            event.realm || null,
            event.application || null,
            event.status,
            event.error_code || null,
            event.error_message || null,
            event.session_id || null,
            event.duration_ms || null,
            event.metadata ? JSON.stringify(event.metadata) : null,
            event.timestamp || new Date().toISOString()
          );
          inserted.push(eventId);
        }
        return inserted;
      });

      const insertedIds = insertMany(events);

      logger.info('Bulk authentication events created', { count: insertedIds.length });

      res.status(201).json({
        success: true,
        data: {
          inserted: insertedIds.length,
          event_ids: insertedIds
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

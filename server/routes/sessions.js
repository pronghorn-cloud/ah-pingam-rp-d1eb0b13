/**
 * Sessions API Routes
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
 * GET /sessions
 * List sessions with filtering and pagination
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['active', 'ended', 'expired']),
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

      if (req.query.user_id) {
        whereClause += ' AND user_id = ?';
        params.push(req.query.user_id);
      }

      if (req.query.start_date) {
        whereClause += ' AND started_at >= ?';
        params.push(req.query.start_date);
      }

      if (req.query.end_date) {
        whereClause += ' AND started_at <= ?';
        params.push(req.query.end_date);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM sessions WHERE ${whereClause}`);
      const { total } = countStmt.get(...params);

      const dataStmt = db.prepare(`
        SELECT * FROM sessions 
        WHERE ${whereClause}
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `);
      const sessions = dataStmt.all(...params, limit, offset);

      res.json({
        success: true,
        data: sessions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /sessions/active
 * Get currently active sessions
 */
router.get('/active', (req, res, next) => {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM sessions 
      WHERE status = 'active'
      ORDER BY last_activity DESC
    `);
    const sessions = stmt.all();

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sessions/stats
 * Get session statistics
 */
router.get('/stats', (req, res, next) => {
  try {
    const db = getDatabase();
    
    // Active sessions count
    const activeCount = db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE status = 'active'
    `).get().count;

    // Sessions by realm
    const byRealm = db.prepare(`
      SELECT realm, COUNT(*) as count 
      FROM sessions 
      WHERE status = 'active'
      GROUP BY realm
    `).all();

    // Average session duration (ended sessions)
    const avgDuration = db.prepare(`
      SELECT AVG((julianday(ended_at) - julianday(started_at)) * 86400) as avg_seconds
      FROM sessions 
      WHERE status = 'ended' AND ended_at IS NOT NULL
    `).get().avg_seconds || 0;

    // Sessions created in last 24 hours
    const last24h = db.prepare(`
      SELECT COUNT(*) as count 
      FROM sessions 
      WHERE started_at >= datetime('now', '-24 hours')
    `).get().count;

    res.json({
      success: true,
      data: {
        activeSessions: activeCount,
        sessionsByRealm: byRealm,
        averageDurationSeconds: Math.round(avgDuration),
        sessionsLast24Hours: last24h
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /sessions/:id
 * Get single session by ID
 */
router.get('/:id',
  [param('id').isInt().toInt()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
      const session = stmt.get(req.params.id);

      if (!session) {
        throw new AppError('Session not found', 404, 'NOT_FOUND');
      }

      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /sessions
 * Create new session
 */
router.post('/',
  [
    body('user_id').notEmpty().isString(),
    body('username').optional().isString(),
    body('client_ip').optional().isIP(),
    body('user_agent').optional().isString(),
    body('realm').optional().isString(),
    body('application').optional().isString(),
    body('metadata').optional().isObject()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const sessionId = uuidv4();

      const stmt = db.prepare(`
        INSERT INTO sessions (
          session_id, user_id, username, client_ip, user_agent,
          realm, application, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        sessionId,
        req.body.user_id,
        req.body.username || null,
        req.body.client_ip || req.ip,
        req.body.user_agent || req.get('User-Agent'),
        req.body.realm || null,
        req.body.application || null,
        req.body.metadata ? JSON.stringify(req.body.metadata) : null
      );

      logger.info('Session created', { sessionId, userId: req.body.user_id });

      res.status(201).json({
        success: true,
        data: { id: result.lastInsertRowid, session_id: sessionId }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /sessions/:id/end
 * End a session
 */
router.patch('/:id/end',
  [param('id').isInt().toInt()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE sessions 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `);
      
      const result = stmt.run(req.params.id);

      if (result.changes === 0) {
        throw new AppError('Session not found or already ended', 404, 'NOT_FOUND');
      }

      logger.info('Session ended', { sessionId: req.params.id });

      res.json({ success: true, message: 'Session ended successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

/**
 * Metrics API Routes
 */

const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { getDatabase } = require('../database/init');
const logger = require('../utils/logger');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

/**
 * GET /metrics/overview
 * Get overview metrics for dashboard
 */
router.get('/overview', (req, res, next) => {
  try {
    const db = getDatabase();

    // Total authentication events (last 24h)
    const authEvents24h = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
      FROM auth_events
      WHERE timestamp >= datetime('now', '-24 hours')
    `).get();

    // Active sessions
    const activeSessions = db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE status = 'active'
    `).get().count;

    // Active alerts
    const activeAlerts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning
      FROM alerts
      WHERE status = 'active'
    `).get();

    // Average response time (last hour)
    const avgResponseTime = db.prepare(`
      SELECT AVG(response_time_ms) as avg_ms
      FROM api_access_logs
      WHERE timestamp >= datetime('now', '-1 hour')
    `).get().avg_ms || 0;

    res.json({
      success: true,
      data: {
        authenticationEvents: {
          total: authEvents24h.total,
          success: authEvents24h.success,
          failure: authEvents24h.failure,
          successRate: authEvents24h.total > 0 
            ? ((authEvents24h.success / authEvents24h.total) * 100).toFixed(2) 
            : 100
        },
        activeSessions,
        alerts: {
          total: activeAlerts.total,
          critical: activeAlerts.critical,
          warning: activeAlerts.warning
        },
        averageResponseTimeMs: Math.round(avgResponseTime)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/auth-trends
 * Get authentication trends over time
 */
router.get('/auth-trends',
  [
    query('period').optional().isIn(['hour', 'day', 'week', 'month']),
    query('interval').optional().isIn(['minute', 'hour', 'day'])
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const period = req.query.period || 'day';
      const interval = req.query.interval || 'hour';

      let periodClause, groupFormat;
      
      switch (period) {
        case 'hour':
          periodClause = "datetime('now', '-1 hour')";
          groupFormat = '%Y-%m-%d %H:%M';
          break;
        case 'week':
          periodClause = "datetime('now', '-7 days')";
          groupFormat = '%Y-%m-%d';
          break;
        case 'month':
          periodClause = "datetime('now', '-30 days')";
          groupFormat = '%Y-%m-%d';
          break;
        default: // day
          periodClause = "datetime('now', '-24 hours')";
          groupFormat = '%Y-%m-%d %H:00';
      }

      const stmt = db.prepare(`
        SELECT 
          strftime('${groupFormat}', timestamp) as time_bucket,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
        FROM auth_events
        WHERE timestamp >= ${periodClause}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `);

      const trends = stmt.all();

      res.json({
        success: true,
        data: {
          period,
          interval,
          trends
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /metrics/top-users
 * Get top users by authentication events
 */
router.get('/top-users',
  [query('limit').optional().isInt({ min: 1, max: 50 }).toInt()],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const limit = req.query.limit || 10;

      const stmt = db.prepare(`
        SELECT 
          user_id,
          username,
          COUNT(*) as total_events,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure_count,
          MAX(timestamp) as last_activity
        FROM auth_events
        WHERE user_id IS NOT NULL
          AND timestamp >= datetime('now', '-24 hours')
        GROUP BY user_id
        ORDER BY total_events DESC
        LIMIT ?
      `);

      const users = stmt.all(limit);

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /metrics/by-application
 * Get metrics grouped by application
 */
router.get('/by-application', (req, res, next) => {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT 
        COALESCE(application, 'Unknown') as application,
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure_count,
        AVG(duration_ms) as avg_duration_ms
      FROM auth_events
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY application
      ORDER BY total_events DESC
    `);

    const applications = stmt.all();

    res.json({
      success: true,
      data: applications
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/by-realm
 * Get metrics grouped by realm
 */
router.get('/by-realm', (req, res, next) => {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT 
        COALESCE(realm, 'Unknown') as realm,
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure_count
      FROM auth_events
      WHERE timestamp >= datetime('now', '-24 hours')
      GROUP BY realm
      ORDER BY total_events DESC
    `);

    const realms = stmt.all();

    res.json({
      success: true,
      data: realms
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/failure-analysis
 * Analyze authentication failures
 */
router.get('/failure-analysis', (req, res, next) => {
  try {
    const db = getDatabase();

    // Failures by error code
    const byErrorCode = db.prepare(`
      SELECT 
        COALESCE(error_code, 'UNKNOWN') as error_code,
        COUNT(*) as count
      FROM auth_events
      WHERE status = 'failure'
        AND timestamp >= datetime('now', '-24 hours')
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 10
    `).all();

    // Failures by client IP (potential brute force)
    const byClientIP = db.prepare(`
      SELECT 
        client_ip,
        COUNT(*) as failure_count
      FROM auth_events
      WHERE status = 'failure'
        AND timestamp >= datetime('now', '-1 hour')
        AND client_ip IS NOT NULL
      GROUP BY client_ip
      HAVING failure_count >= 5
      ORDER BY failure_count DESC
      LIMIT 10
    `).all();

    // Failures over time (last 24h, hourly)
    const overTime = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00', timestamp) as hour,
        COUNT(*) as count
      FROM auth_events
      WHERE status = 'failure'
        AND timestamp >= datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    res.json({
      success: true,
      data: {
        byErrorCode,
        suspiciousIPs: byClientIP,
        failuresOverTime: overTime
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

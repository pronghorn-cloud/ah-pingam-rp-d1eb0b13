/**
 * Reports API Routes
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
 * GET /reports/summary
 * Get comprehensive summary report
 */
router.get('/summary',
  [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('period').optional().isIn(['day', 'week', 'month'])
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const period = req.query.period || 'day';
      
      let dateFilter;
      switch (period) {
        case 'week':
          dateFilter = "datetime('now', '-7 days')";
          break;
        case 'month':
          dateFilter = "datetime('now', '-30 days')";
          break;
        default:
          dateFilter = "datetime('now', '-24 hours')";
      }

      // Authentication summary
      const authSummary = db.prepare(`
        SELECT 
          COUNT(*) as total_events,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT client_ip) as unique_ips,
          AVG(duration_ms) as avg_duration_ms
        FROM auth_events
        WHERE timestamp >= ${dateFilter}
      `).get();

      // Session summary
      const sessionSummary = db.prepare(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'ended' THEN 1 ELSE 0 END) as ended,
          COUNT(DISTINCT user_id) as unique_users
        FROM sessions
        WHERE started_at >= ${dateFilter}
      `).get();

      // Alert summary
      const alertSummary = db.prepare(`
        SELECT 
          COUNT(*) as total_alerts,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
          SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning
        FROM alerts
        WHERE triggered_at >= ${dateFilter}
      `).get();

      // Top event types
      const topEventTypes = db.prepare(`
        SELECT event_type, COUNT(*) as count
        FROM auth_events
        WHERE timestamp >= ${dateFilter}
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 10
      `).all();

      // Top applications
      const topApplications = db.prepare(`
        SELECT 
          COALESCE(application, 'Unknown') as application,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
        FROM auth_events
        WHERE timestamp >= ${dateFilter}
        GROUP BY application
        ORDER BY total DESC
        LIMIT 10
      `).all();

      res.json({
        success: true,
        data: {
          period,
          generatedAt: new Date().toISOString(),
          authentication: {
            ...authSummary,
            successRate: authSummary.total_events > 0 
              ? ((authSummary.successful / authSummary.total_events) * 100).toFixed(2)
              : 100
          },
          sessions: sessionSummary,
          alerts: alertSummary,
          topEventTypes,
          topApplications
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/authentication
 * Detailed authentication report
 */
router.get('/authentication',
  [
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('group_by').optional().isIn(['hour', 'day', 'application', 'realm', 'user'])
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const startDate = req.query.start_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = req.query.end_date || new Date().toISOString();
      const groupBy = req.query.group_by || 'hour';

      let groupColumn, selectColumn;
      switch (groupBy) {
        case 'day':
          groupColumn = "strftime('%Y-%m-%d', timestamp)";
          selectColumn = 'date';
          break;
        case 'application':
          groupColumn = "COALESCE(application, 'Unknown')";
          selectColumn = 'application';
          break;
        case 'realm':
          groupColumn = "COALESCE(realm, 'Unknown')";
          selectColumn = 'realm';
          break;
        case 'user':
          groupColumn = 'user_id';
          selectColumn = 'user_id';
          break;
        default:
          groupColumn = "strftime('%Y-%m-%d %H:00', timestamp)";
          selectColumn = 'hour';
      }

      const stmt = db.prepare(`
        SELECT 
          ${groupColumn} as ${selectColumn},
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
          AVG(duration_ms) as avg_duration_ms
        FROM auth_events
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY ${groupColumn}
        ORDER BY ${groupBy === 'hour' || groupBy === 'day' ? selectColumn : 'total DESC'}
      `);

      const data = stmt.all(startDate, endDate);

      res.json({
        success: true,
        data: {
          startDate,
          endDate,
          groupBy,
          records: data
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/security
 * Security-focused report
 */
router.get('/security',
  [
    query('period').optional().isIn(['hour', 'day', 'week'])
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const period = req.query.period || 'day';
      
      let dateFilter;
      switch (period) {
        case 'hour':
          dateFilter = "datetime('now', '-1 hour')";
          break;
        case 'week':
          dateFilter = "datetime('now', '-7 days')";
          break;
        default:
          dateFilter = "datetime('now', '-24 hours')";
      }

      // Failed authentications by IP (potential brute force)
      const suspiciousIPs = db.prepare(`
        SELECT 
          client_ip,
          COUNT(*) as failure_count,
          COUNT(DISTINCT user_id) as targeted_users,
          MIN(timestamp) as first_attempt,
          MAX(timestamp) as last_attempt
        FROM auth_events
        WHERE status = 'failure' 
          AND timestamp >= ${dateFilter}
          AND client_ip IS NOT NULL
        GROUP BY client_ip
        HAVING failure_count >= 5
        ORDER BY failure_count DESC
        LIMIT 20
      `).all();

      // Failed authentications by user (account lockout candidates)
      const suspiciousUsers = db.prepare(`
        SELECT 
          user_id,
          username,
          COUNT(*) as failure_count,
          COUNT(DISTINCT client_ip) as unique_ips,
          MIN(timestamp) as first_attempt,
          MAX(timestamp) as last_attempt
        FROM auth_events
        WHERE status = 'failure' 
          AND timestamp >= ${dateFilter}
          AND user_id IS NOT NULL
        GROUP BY user_id
        HAVING failure_count >= 3
        ORDER BY failure_count DESC
        LIMIT 20
      `).all();

      // Error code distribution
      const errorDistribution = db.prepare(`
        SELECT 
          COALESCE(error_code, 'UNKNOWN') as error_code,
          COUNT(*) as count
        FROM auth_events
        WHERE status = 'failure' 
          AND timestamp >= ${dateFilter}
        GROUP BY error_code
        ORDER BY count DESC
      `).all();

      // Critical alerts
      const criticalAlerts = db.prepare(`
        SELECT *
        FROM alerts
        WHERE severity = 'critical' 
          AND status IN ('active', 'acknowledged')
          AND triggered_at >= ${dateFilter}
        ORDER BY triggered_at DESC
      `).all();

      res.json({
        success: true,
        data: {
          period,
          generatedAt: new Date().toISOString(),
          suspiciousIPs,
          suspiciousUsers,
          errorDistribution,
          criticalAlerts,
          summary: {
            suspiciousIPCount: suspiciousIPs.length,
            suspiciousUserCount: suspiciousUsers.length,
            criticalAlertCount: criticalAlerts.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /reports/export
 * Export report data
 */
router.get('/export',
  [
    query('type').isIn(['auth_events', 'sessions', 'alerts']),
    query('format').optional().isIn(['json', 'csv']),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 10000 }).toInt()
  ],
  validate,
  (req, res, next) => {
    try {
      const db = getDatabase();
      const type = req.query.type;
      const format = req.query.format || 'json';
      const limit = req.query.limit || 1000;
      const startDate = req.query.start_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = req.query.end_date || new Date().toISOString();

      let data;
      let dateColumn;

      switch (type) {
        case 'sessions':
          dateColumn = 'started_at';
          break;
        case 'alerts':
          dateColumn = 'triggered_at';
          break;
        default:
          dateColumn = 'timestamp';
      }

      const stmt = db.prepare(`
        SELECT * FROM ${type}
        WHERE ${dateColumn} >= ? AND ${dateColumn} <= ?
        ORDER BY ${dateColumn} DESC
        LIMIT ?
      `);
      data = stmt.all(startDate, endDate, limit);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
        
        if (data.length === 0) {
          return res.send('');
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(h => {
            const val = row[h];
            if (val === null) return '';
            if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
            return val;
          }).join(','))
        ].join('\n');

        return res.send(csvContent);
      }

      res.json({
        success: true,
        data: {
          type,
          startDate,
          endDate,
          count: data.length,
          records: data
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

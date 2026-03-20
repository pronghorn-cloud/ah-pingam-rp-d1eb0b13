/**
 * API Routes Index
 */

const express = require('express');
const router = express.Router();

const authEventsRouter = require('./authEvents');
const sessionsRouter = require('./sessions');
const metricsRouter = require('./metrics');
const alertsRouter = require('./alerts');
const dashboardRouter = require('./dashboard');
const reportsRouter = require('./reports');

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/auth-events`, authEventsRouter);
router.use(`${API_VERSION}/sessions`, sessionsRouter);
router.use(`${API_VERSION}/metrics`, metricsRouter);
router.use(`${API_VERSION}/alerts`, alertsRouter);
router.use(`${API_VERSION}/dashboard`, dashboardRouter);
router.use(`${API_VERSION}/reports`, reportsRouter);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'PingAM Analytics API',
    version: '1.0.0',
    endpoints: {
      authEvents: `${API_VERSION}/auth-events`,
      sessions: `${API_VERSION}/sessions`,
      metrics: `${API_VERSION}/metrics`,
      alerts: `${API_VERSION}/alerts`,
      dashboard: `${API_VERSION}/dashboard`,
      reports: `${API_VERSION}/reports`
    }
  });
});

module.exports = router;

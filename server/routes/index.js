/**
 * API Routes Index
 */

const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const configRouter = require('./config');
const authEventsRouter = require('./authEvents');
const sessionsRouter = require('./sessions');
const metricsRouter = require('./metrics');
const alertsRouter = require('./alerts');
const dashboardRouter = require('./dashboard');
const reportsRouter = require('./reports');
const pingamInstancesRouter = require('./pingam-instances');

// API version prefix
const API_VERSION = '/v1';

// Mount routes
router.use(`${API_VERSION}/auth`, authRouter);
router.use(`${API_VERSION}/config`, configRouter);
router.use(`${API_VERSION}/auth-events`, authEventsRouter);
router.use(`${API_VERSION}/sessions`, sessionsRouter);
router.use(`${API_VERSION}/metrics`, metricsRouter);
router.use(`${API_VERSION}/alerts`, alertsRouter);
router.use(`${API_VERSION}/dashboard`, dashboardRouter);
router.use(`${API_VERSION}/reports`, reportsRouter);
router.use(`${API_VERSION}/pingam-instances`, pingamInstancesRouter);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'PingAM Analytics API',
    version: '1.0.0',
    endpoints: {
      auth: `${API_VERSION}/auth`,
      config: `${API_VERSION}/config`,
      authEvents: `${API_VERSION}/auth-events`,
      sessions: `${API_VERSION}/sessions`,
      metrics: `${API_VERSION}/metrics`,
      alerts: `${API_VERSION}/alerts`,
      dashboard: `${API_VERSION}/dashboard`,
      reports: `${API_VERSION}/reports`,
      pingamInstances: `${API_VERSION}/pingam-instances`
    }
  });
});

module.exports = router;

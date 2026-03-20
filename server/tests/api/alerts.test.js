/**
 * Alerts API Tests
 */

const request = require('supertest');
const { app } = require('../../index');
const { initializeDatabase, closeDatabase } = require('../../database/init');

describe('Alerts API', () => {
  let testAlertId;

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('POST /api/v1/alerts', () => {
    it('should create a new alert', async () => {
      const alertData = {
        alert_type: 'BRUTE_FORCE',
        severity: 'critical',
        title: 'Multiple failed login attempts detected',
        description: 'User account experienced 10+ failed login attempts',
        source: 'auth-monitor'
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(alertData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alert_id).toBeDefined();
      testAlertId = response.body.data.id;
    });

    it('should reject invalid severity', async () => {
      const invalidData = {
        alert_type: 'TEST',
        severity: 'invalid',
        title: 'Test Alert'
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require title', async () => {
      const invalidData = {
        alert_type: 'TEST',
        severity: 'warning'
        // missing title
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/alerts', () => {
    it('should list alerts with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter alerts by severity', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .query({ severity: 'critical' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(alert => {
        expect(alert.severity).toBe('critical');
      });
    });

    it('should filter alerts by status', async () => {
      const response = await request(app)
        .get('/api/v1/alerts')
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/alerts/active', () => {
    it('should return active alerts summary', async () => {
      const response = await request(app)
        .get('/api/v1/alerts/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toBeInstanceOf(Array);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });
  });

  describe('PATCH /api/v1/alerts/:id/acknowledge', () => {
    it('should acknowledge an active alert', async () => {
      // Create a new alert first
      const createResponse = await request(app)
        .post('/api/v1/alerts')
        .send({
          alert_type: 'TEST',
          severity: 'warning',
          title: 'Test Alert for Acknowledge'
        });

      const alertId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/v1/alerts/${alertId}/acknowledge`)
        .send({ acknowledged_by: 'test-admin' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('acknowledged');
    });

    it('should require acknowledged_by field', async () => {
      const response = await request(app)
        .patch(`/api/v1/alerts/${testAlertId}/acknowledge`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/alerts/:id/resolve', () => {
    it('should resolve an alert', async () => {
      // Create a new alert first
      const createResponse = await request(app)
        .post('/api/v1/alerts')
        .send({
          alert_type: 'TEST',
          severity: 'info',
          title: 'Test Alert for Resolve'
        });

      const alertId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/v1/alerts/${alertId}/resolve`)
        .send({ resolved_by: 'test-admin' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resolved');
    });
  });
});

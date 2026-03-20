/**
 * Metrics API Tests
 */

const request = require('supertest');
const { app } = require('../../index');
const { initializeDatabase, closeDatabase, getDatabase } = require('../../database/init');

describe('Metrics API', () => {
  beforeAll(async () => {
    await initializeDatabase();
    
    // Seed test data
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO auth_events (event_id, event_type, status, user_id, username, application, realm, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
    `);
    
    for (let i = 0; i < 20; i++) {
      stmt.run(
        `metrics-event-${i}`,
        i % 2 === 0 ? 'LOGIN' : 'LOGOUT',
        i % 4 === 0 ? 'failure' : 'success',
        `metrics-user-${i % 5}`,
        `metricsuser${i % 5}`,
        i % 3 === 0 ? 'app-a' : 'app-b',
        i % 2 === 0 ? 'realm-1' : 'realm-2',
        i
      );
    }
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('GET /api/v1/metrics/overview', () => {
    it('should return overview metrics', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/overview')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticationEvents).toBeDefined();
      expect(response.body.data.authenticationEvents.total).toBeDefined();
      expect(response.body.data.authenticationEvents.success).toBeDefined();
      expect(response.body.data.authenticationEvents.failure).toBeDefined();
      expect(response.body.data.authenticationEvents.successRate).toBeDefined();
      expect(response.body.data.activeSessions).toBeDefined();
      expect(response.body.data.alerts).toBeDefined();
    });
  });

  describe('GET /api/v1/metrics/auth-trends', () => {
    it('should return authentication trends', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/auth-trends')
        .query({ period: 'day' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('day');
      expect(response.body.data.trends).toBeInstanceOf(Array);
    });

    it('should accept different periods', async () => {
      const periods = ['hour', 'day', 'week', 'month'];

      for (const period of periods) {
        const response = await request(app)
          .get('/api/v1/metrics/auth-trends')
          .query({ period })
          .expect(200);

        expect(response.body.data.period).toBe(period);
      }
    });
  });

  describe('GET /api/v1/metrics/top-users', () => {
    it('should return top users', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/top-users')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should include user statistics', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/top-users')
        .expect(200);

      if (response.body.data.length > 0) {
        const user = response.body.data[0];
        expect(user.user_id).toBeDefined();
        expect(user.total_events).toBeDefined();
        expect(user.success_count).toBeDefined();
        expect(user.failure_count).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/metrics/by-application', () => {
    it('should return metrics grouped by application', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/by-application')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      if (response.body.data.length > 0) {
        const app = response.body.data[0];
        expect(app.application).toBeDefined();
        expect(app.total_events).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/metrics/by-realm', () => {
    it('should return metrics grouped by realm', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/by-realm')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/metrics/failure-analysis', () => {
    it('should return failure analysis', async () => {
      const response = await request(app)
        .get('/api/v1/metrics/failure-analysis')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byErrorCode).toBeInstanceOf(Array);
      expect(response.body.data.failuresOverTime).toBeInstanceOf(Array);
    });
  });
});

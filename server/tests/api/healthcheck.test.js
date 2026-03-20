/**
 * Health Check Endpoint Tests
 */

const request = require('supertest');
const { app } = require('../../index');
const { initializeDatabase, closeDatabase } = require('../../database/init');

describe('Health Check Endpoints', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.environment).toBe('test');
    });
  });

  describe('GET /ready', () => {
    it('should return ready status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body.name).toBe('PingAM Analytics API');
      expect(response.body.version).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
    });
  });
});

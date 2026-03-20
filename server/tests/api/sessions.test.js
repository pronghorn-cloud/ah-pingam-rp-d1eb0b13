/**
 * Sessions API Tests
 */

const request = require('supertest');
const { app } = require('../../index');
const { initializeDatabase, closeDatabase } = require('../../database/init');

describe('Sessions API', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('POST /api/v1/sessions', () => {
    it('should create a new session', async () => {
      const sessionData = {
        user_id: 'session-user-123',
        username: 'sessionuser',
        application: 'test-app',
        realm: 'test-realm'
      };

      const response = await request(app)
        .post('/api/v1/sessions')
        .send(sessionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBeDefined();
      expect(response.body.data.id).toBeDefined();
    });

    it('should reject session without user_id', async () => {
      const invalidData = {
        username: 'testuser'
        // missing required user_id
      };

      const response = await request(app)
        .post('/api/v1/sessions')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/sessions', () => {
    it('should list sessions with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/sessions')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter sessions by status', async () => {
      const response = await request(app)
        .get('/api/v1/sessions')
        .query({ status: 'active' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/sessions/active', () => {
    it('should return active sessions', async () => {
      const response = await request(app)
        .get('/api/v1/sessions/active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.count).toBeDefined();
    });
  });

  describe('GET /api/v1/sessions/stats', () => {
    it('should return session statistics', async () => {
      const response = await request(app)
        .get('/api/v1/sessions/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activeSessions).toBeDefined();
      expect(response.body.data.averageDurationSeconds).toBeDefined();
      expect(response.body.data.sessionsLast24Hours).toBeDefined();
    });
  });

  describe('PATCH /api/v1/sessions/:id/end', () => {
    it('should end an active session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/v1/sessions')
        .send({
          user_id: 'end-session-user',
          username: 'enduser'
        });

      const sessionId = createResponse.body.data.id;

      const response = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/end`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('ended');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .patch('/api/v1/sessions/99999/end')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

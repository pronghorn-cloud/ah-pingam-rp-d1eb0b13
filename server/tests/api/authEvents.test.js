/**
 * Authentication Events API Tests
 */

const request = require('supertest');
const { app } = require('../../index');
const { initializeDatabase, closeDatabase, getDatabase } = require('../../database/init');

describe('Authentication Events API', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('POST /api/v1/auth-events', () => {
    it('should create a new authentication event', async () => {
      const eventData = {
        event_type: 'LOGIN',
        status: 'success',
        user_id: 'user-123',
        username: 'testuser',
        application: 'test-app',
        realm: 'test-realm'
      };

      const response = await request(app)
        .post('/api/v1/auth-events')
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.event_id).toBeDefined();
      expect(response.body.data.id).toBeDefined();
    });

    it('should reject invalid event data', async () => {
      const invalidData = {
        event_type: 'LOGIN'
        // missing required 'status' field
      };

      const response = await request(app)
        .post('/api/v1/auth-events')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate status values', async () => {
      const invalidData = {
        event_type: 'LOGIN',
        status: 'invalid_status'
      };

      const response = await request(app)
        .post('/api/v1/auth-events')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth-events', () => {
    beforeAll(async () => {
      // Create test data
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO auth_events (event_id, event_type, status, user_id, username, application)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      for (let i = 0; i < 5; i++) {
        stmt.run(
          `test-event-${i}`,
          i % 2 === 0 ? 'LOGIN' : 'LOGOUT',
          i % 3 === 0 ? 'failure' : 'success',
          `user-${i}`,
          `testuser${i}`,
          'test-app'
        );
      }
    });

    it('should list authentication events with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/auth-events')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter events by status', async () => {
      const response = await request(app)
        .get('/api/v1/auth-events')
        .query({ status: 'success' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(event => {
        expect(event.status).toBe('success');
      });
    });

    it('should filter events by event_type', async () => {
      const response = await request(app)
        .get('/api/v1/auth-events')
        .query({ event_type: 'LOGIN' })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(event => {
        expect(event.event_type).toBe('LOGIN');
      });
    });
  });

  describe('GET /api/v1/auth-events/:id', () => {
    it('should get a single event by ID', async () => {
      // First create an event
      const createResponse = await request(app)
        .post('/api/v1/auth-events')
        .send({
          event_type: 'LOGIN',
          status: 'success',
          user_id: 'user-single'
        });

      const eventId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/auth-events/${eventId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(eventId);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/v1/auth-events/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth-events/bulk', () => {
    it('should create multiple events in bulk', async () => {
      const events = [
        { event_type: 'LOGIN', status: 'success', user_id: 'bulk-user-1' },
        { event_type: 'LOGOUT', status: 'success', user_id: 'bulk-user-2' },
        { event_type: 'LOGIN', status: 'failure', user_id: 'bulk-user-3' }
      ];

      const response = await request(app)
        .post('/api/v1/auth-events/bulk')
        .send({ events })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.inserted).toBe(3);
      expect(response.body.data.event_ids).toHaveLength(3);
    });
  });
});

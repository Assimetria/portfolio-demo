/**
 * API tests for the @custom chat state management endpoint.
 *
 * Exercises thread CRUD and message endpoints scoped to the authenticated user.
 * External deps (DB, Redis, Email) are mocked so the suite runs in CI
 * without any external services.
 */

const request = require('supertest');
const crypto = require('crypto');

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {},
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
    result: jest.fn(),
  };
  return mockDb;
});

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Redis', () => ({
  client: {
    get: jest.fn(async () => null),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(async () => 0),
    incr: jest.fn(async () => 1),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
  },
  isReady: () => false,
}));

// ── Mock Email ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Set up JWT keys BEFORE requiring the app
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n');

const app = require('../../../src/app');

describe('@custom chat state management API', () => {
  describe('GET /api/chat/threads', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/chat/threads');
      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid bearer token', async () => {
      const res = await request(app)
        .get('/api/chat/threads')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('returns JSON content-type on unauthorized', async () => {
      const res = await request(app).get('/api/chat/threads');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('POST /api/chat/threads', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/chat/threads')
        .send({ title: 'Test Chat' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/chat/threads/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/chat/threads/1');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/chat/threads/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/chat/threads/1')
        .send({ title: 'Updated' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/chat/threads/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).delete('/api/chat/threads/1');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/chat/threads/:id/messages', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/chat/threads/1/messages');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/chat/threads/:id/messages', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/chat/threads/1/messages')
        .send({ content: 'Hello', sender: 'user' });
      expect(res.status).toBe(401);
    });
  });
});
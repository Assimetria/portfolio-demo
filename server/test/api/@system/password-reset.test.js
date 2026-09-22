/**
 * API tests for password reset flows:
 *   POST /api/auth/forgot-password  — request a reset link
 *   POST /api/auth/reset-password   — apply a reset token
 *
 * All external dependencies (DB, Redis, Email) are mocked so tests are
 * fast and runnable in CI without any real services.
 */

const request = require('supertest');

// ── Mock PostgreSQL ────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/PostgreSQL', () => {
  const mockDb = {
    _reset() {},
    one: jest.fn(),
    oneOrNone: jest.fn(),
    none: jest.fn(),
    any: jest.fn(),
    tx: jest.fn(async (fn) => fn(mockDb)),
  };
  return mockDb;
});

// ── Mock Redis ─────────────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Redis', () => {
  const store = new Map();
  const client = {
    get: jest.fn(async (k) => store.get(k) ?? null),
    set: jest.fn(async (k, v) => store.set(k, v)),
    del: jest.fn(async (k) => store.delete(k)),
    exists: jest.fn(async (k) => (store.has(k) ? 1 : 0)),
    incr: jest.fn(async (k) => {
      const n = parseInt(store.get(k) ?? '0', 10) + 1;
      store.set(k, String(n));
      return n;
    }),
    expire: jest.fn(),
    ttl: jest.fn(async () => -1),
    _store: store,
    _reset: () => store.clear(),
  };
  return { client, isReady: () => false };
});

// ── Mock Email service ─────────────────────────────────────────────────────
jest.mock('../../../src/lib/@system/Email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Generate JWT keys before loading the app so jwt module captures valid keys
const crypto = require('crypto');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
process.env.JWT_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
process.env.JWT_PUBLIC_KEY = publicKey.replace(/\n/g, '\\n');

const app = require('../../../src/app');
const db = require('../../../src/lib/@system/PostgreSQL');
const { client: redis } = require('../../../src/lib/@system/Redis');

beforeEach(() => {
  db._reset();
  redis._reset();
  jest.clearAllMocks();
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────

describe('POST /api/auth/forgot-password — request reset link', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('returns 200 with generic message when user is NOT found (prevents enumeration)', async () => {
    db.oneOrNone.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nowhere.invalid' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account/i);
    // Email must NOT be sent when user does not exist
    const Email = require('../../../src/lib/@system/Email');
    expect(Email.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns 200 and sends reset email when user exists', async () => {
    db.oneOrNone.mockResolvedValue({ id: 42, email: 'user@example.com', name: 'Alice' });
    db.none.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account/i);
    // Token insert must have been called
    expect(db.none).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO password_reset_tokens'),
      expect.any(Array),
    );
  });

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValue(new Error('Connection terminated due to connection timeout'));

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/temporarily unavailable/i);
  });
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────

describe('POST /api/auth/reset-password — apply reset token', () => {
  const validToken = 'a'.repeat(64);
  const validPassword = 'NewSecurePass1!';

  const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: validPassword });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/token/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('returns 400 when token is not found in DB', async () => {
    db.oneOrNone.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: validPassword });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it('returns 400 when reset token has already been used', async () => {
    db.oneOrNone.mockResolvedValue({
      id: 1,
      user_id: 42,
      used_at: new Date().toISOString(),
      expires_at: futureExpiry,
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: validPassword });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already been used/i);
  });

  it('returns 400 when reset token has expired', async () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    db.oneOrNone.mockResolvedValue({
      id: 1,
      user_id: 42,
      used_at: null,
      expires_at: pastExpiry,
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: validPassword });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('returns 200 and updates password for a valid unused non-expired token', async () => {
    db.oneOrNone.mockResolvedValue({
      id: 1,
      user_id: 42,
      used_at: null,
      expires_at: futureExpiry,
    });
    // db.tx resolves the callback with the mock db
    db.tx.mockImplementation(async (fn) => fn(db));
    db.none.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: validPassword });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/password updated/i);
    // Both UPDATE statements must have been executed inside the transaction
    expect(db.none).toHaveBeenCalledTimes(2);
  });

  it('returns 503 when DB connection fails', async () => {
    db.oneOrNone.mockRejectedValue(new Error('Connection terminated due to connection timeout'));

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validToken, password: validPassword });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/temporarily unavailable/i);
  });
});

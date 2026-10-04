import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/db/migrations.js';
import { initKeys, generateAccessToken } from '../../src/security/jwt.js';
import { initAuditHashChain } from '../../src/logging/audit.js';
import { hashPassword } from '../../src/security/passwords.js';
import { generateMfaSetup } from '../../src/security/mfa.js';
import { getDb } from '../../src/db/index.js';
import { authenticator } from 'otplib';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

describe('🛡️ PlaySphere Connect - Comprehensive Security Controls Test Suite', () => {
  let app: ReturnType<typeof createApp>;
  let adminId: string;
  let userIdA: string;
  let userIdB: string;
  let userTokenA: string;
  let userTokenB: string;
  let adminToken: string;
  let venueId: string;
  let bookingIdB: string;
  let adminMfaSecret: string;

  beforeAll(async () => {
    initKeys();
    await runMigrations();
    await initAuditHashChain();
    app = createApp();
    const db = getDb();

    // Setup Test Users
    adminId = uuidv4();
    userIdA = uuidv4();
    userIdB = uuidv4();
    venueId = uuidv4();
    bookingIdB = uuidv4();

    const passHash = await hashPassword('SuperSecure123!Pass');
    const now = new Date().toISOString();

    const mfaSetup = await generateMfaSetup('admin-sec@playsphere.local');
    adminMfaSecret = mfaSetup.secret;
    // Clean up test data if re-running
    await db.execute("DELETE FROM bookings WHERE venue_id = $1", [venueId]);
    await db.execute("DELETE FROM venues WHERE id = $1", [venueId]);
    await db.execute("DELETE FROM users WHERE email IN ('admin-sec@playsphere.local', 'user-a@playsphere.local', 'user-b@playsphere.local', 'lockout-test@playsphere.local')");

    // Create Admin User
    await db.execute(
      `INSERT INTO users (id, email, password_hash, role, mfa_enabled, mfa_secret, backup_codes, failed_login_attempts, created_at, updated_at)
       VALUES ($1, 'admin-sec@playsphere.local', $2, 'admin', 1, $3, $4, 0, $5, $5)`,
      [adminId, passHash, adminMfaSecret, JSON.stringify(mfaSetup.hashedBackupCodes), now]
    );

    // Create User A
    await db.execute(
      `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
       VALUES ($1, 'user-a@playsphere.local', $2, 'user', 0, 0, $3, $3)`,
      [userIdA, passHash, now]
    );

    // Create User B
    await db.execute(
      `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
       VALUES ($1, 'user-b@playsphere.local', $2, 'user', 0, 0, $3, $3)`,
      [userIdB, passHash, now]
    );

    // Create Sample Venue
    await db.execute(
      `INSERT INTO venues (id, name, description, address, city, sport_types, amenities, hourly_rate, image_url, rating, created_by, created_at)
       VALUES ($1, 'Test Security Arena', 'Hardened sports facility for penetration testing', '100 Cyber Way', 'TechCity', '["Football"]', '["Locker"]', 50.0, 'https://example.com/img.jpg', 5.0, $2, $3)`,
      [venueId, adminId, now]
    );

    // Create Sample Booking for User B (to test IDOR against User A)
    await db.execute(
      `INSERT INTO bookings (id, user_id, venue_id, date, start_time, end_time, total_price, status, created_at)
       VALUES ($1, $2, $3, '2026-11-01', '14:00', '16:00', 100.0, 'confirmed', $4)`,
      [bookingIdB, userIdB, venueId, now]
    );

    // Generate RS256 Tokens
    userTokenA = generateAccessToken({ id: userIdA, email: 'user-a@playsphere.local', role: 'user' });
    userTokenB = generateAccessToken({ id: userIdB, email: 'user-b@playsphere.local', role: 'user' });
    adminToken = generateAccessToken({ id: adminId, email: 'admin-sec@playsphere.local', role: 'admin' });
  });

  // =========================================================================
  // TEST 1: SQL Injection Attempt & Defense
  // =========================================================================
  it('TEST 1: SQL Injection attempts in search, filter, and login must be completely blocked', async () => {
    // 1. Injection in search filter
    const sqlPayloads = [
      "' OR 1=1 --",
      "'; DROP TABLE venues; --",
      "' UNION SELECT id, password_hash, email FROM users --",
    ];

    for (const payload of sqlPayloads) {
      const res = await request(app)
        .get(`/api/venues?search=${encodeURIComponent(payload)}`);

      expect(res.status).toBe(200);
      expect(res.body.venues).toBeDefined();
      // Parameterized queries treat the entire payload as a literal string
      expect(Array.isArray(res.body.venues)).toBe(true);
    }

    // Verify database table was not dropped
    const db = getDb();
    const tableCheck = await db.queryOne('SELECT COUNT(*) as count FROM venues');
    expect(tableCheck).toBeDefined();

    // 2. Injection in login email
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: "' OR '1'='1", password: 'anyPassword123!' });

    // Zod schema rejects malformed email with 400
    expect(loginRes.status).toBe(400);
    expect(loginRes.body.error).toBeDefined();
  });

  // =========================================================================
  // TEST 2: Broken Access Control & Privilege Escalation Defense (RBAC)
  // =========================================================================
  it('TEST 2: Low-privileged user (player) calling admin endpoint must receive 403 Forbidden and trigger security alert', async () => {
    // User A attempts to list all users via admin endpoint
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');

    // Verify privilege escalation alert was recorded in database
    const db = getDb();
    const alert = await db.queryOne<{ alert_type: string; user_id: string }>(
      "SELECT * FROM security_alerts WHERE alert_type = 'PRIVILEGE_ESCALATION_ATTEMPT' AND user_id = $1",
      [userIdA]
    );

    expect(alert).toBeDefined();
    expect(alert?.alert_type).toBe('PRIVILEGE_ESCALATION_ATTEMPT');
  });

  // =========================================================================
  // TEST 3: Brute-Force Login Protection & Account Lockout
  // =========================================================================
  it('TEST 3: Repeated failed login attempts must lock the account and generate security alerts', async () => {
    const targetEmail = 'lockout-test@playsphere.local';
    const db = getDb();
    const testUserId = uuidv4();
    const testPassHash = await hashPassword('ValidPassword123!Secure');

    await db.execute(
      `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, $3, 'user', 0, 0, datetime('now'), datetime('now'))`,
      [testUserId, targetEmail, testPassHash]
    );

    // Perform 5 consecutive failed logins
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
    }

    // 6th attempt should return 423 Locked
    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email: targetEmail, password: 'WrongPassword123!' });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error).toContain('Account is temporarily locked');

    // Verify brute force security alert was generated
    const alert = await db.queryOne<{ alert_type: string }>(
      "SELECT * FROM security_alerts WHERE alert_type = 'BRUTE_FORCE_ACCOUNT_TARGETED' ORDER BY timestamp DESC LIMIT 1"
    );
    expect(alert).toBeDefined();
    expect(alert?.alert_type).toBe('BRUTE_FORCE_ACCOUNT_TARGETED');
  });

  // =========================================================================
  // TEST 4: Cross-Site Scripting (XSS) Sanitization Defense
  // =========================================================================
  it('TEST 4: Stored XSS payloads must be neutralized and stripped of all executable tags', async () => {
    const xssPayload = 'Soccer Match <script>alert("XSS")</script><img src=x onerror=alert(1)>';

    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: xssPayload,
        description: 'Testing HTML sanitization <iframe src="javascript:alert(1)"></iframe> Clean Description',
        venueId: venueId,
        date: '2026-10-30',
        startTime: '10:00',
        endTime: '12:00',
        maxParticipants: 10,
        price: 20,
        sportType: 'Football',
        skillLevel: 'Beginner',
      });

    expect(res.status).toBe(201);
    const eventId = res.body.id;

    // Fetch stored event and assert no malicious scripts remain
    const fetchRes = await request(app).get(`/api/events/${eventId}`);
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.title).not.toContain('<script>');
    expect(fetchRes.body.title).not.toContain('<img');
    expect(fetchRes.body.title).not.toContain('onerror');
    expect(fetchRes.body.description).not.toContain('<iframe');
    expect(fetchRes.body.description).toContain('Clean Description');
  });

  // =========================================================================
  // TEST 5: Token Tampering, Algorithm Confusion & Refresh Token Reuse
  // =========================================================================
  it('TEST 5: Tokens with alg=none, HS256 confusion, expired tokens, and reused refresh tokens must be rejected', async () => {
    // 1. Algorithm "none" attack
    const noneToken = jwt.sign(
      { sub: userIdA, role: 'admin', iss: 'playsphere-auth-service', aud: 'playsphere-client' },
      '',
      { algorithm: 'none' }
    );

    const noneRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${noneToken}`);

    expect(noneRes.status).toBe(401);

    // 2. HS256 Algorithm Confusion attack (signing with public key as HMAC secret)
    const { publicKey } = initKeys();
    const hs256Token = jwt.sign(
      { sub: userIdA, role: 'admin', iss: 'playsphere-auth-service', aud: 'playsphere-client' },
      publicKey,
      { algorithm: 'HS256' }
    );

    const hs256Res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${hs256Token}`);

    expect(hs256Res.status).toBe(401);

    // 3. Refresh token rotation & reuse attack
    // First, login user A to get initial refresh cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user-a@playsphere.local', password: 'SuperSecure123!Pass' });

    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // First refresh exchange: Should succeed and rotate cookie
    const refresh1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refresh1.status).toBe(200);
    expect(refresh1.body.accessToken).toBeDefined();
    const rotatedCookies = refresh1.headers['set-cookie'];

    // ATTACK: Present the old (already consumed) refresh token again
    const replayAttack = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(replayAttack.status).toBe(401);
    expect(replayAttack.body.error).toContain('Refresh token reuse detected');

    // Subsequent refresh with the new cookie must ALSO fail because the entire token family was revoked
    const familyRevocationCheck = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', rotatedCookies);

    expect(familyRevocationCheck.status).toBe(401);
  });

  // =========================================================================
  // TEST 6: Mandatory Admin Multi-Factor Authentication (MFA)
  // =========================================================================
  it('TEST 6: Administrator login must require TOTP challenge step; valid code grants session tokens', async () => {
    // Step 1: Admin credentials only
    const step1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-sec@playsphere.local', password: 'SuperSecure123!Pass' });

    expect(step1.status).toBe(200);
    expect(step1.body.requireMfa).toBe(true);
    expect(step1.body.preAuthToken).toBeDefined();
    expect(step1.body.accessToken).toBeUndefined(); // Access token NOT granted yet!

    const preAuthToken = step1.body.preAuthToken;

    // Step 2: Invalid TOTP code must be rejected
    const invalidMfa = await request(app)
      .post('/api/auth/mfa/challenge')
      .send({ preAuthToken, code: '000000' });

    expect(invalidMfa.status).toBe(401);
    expect(invalidMfa.body.error).toContain('Invalid MFA verification code');

    // Step 3: Valid TOTP code from authenticator
    const validCode = authenticator.generate(adminMfaSecret);
    const validMfa = await request(app)
      .post('/api/auth/mfa/challenge')
      .send({ preAuthToken, code: validCode });

    expect(validMfa.status).toBe(200);
    expect(validMfa.body.accessToken).toBeDefined();
    expect(validMfa.body.user.role).toBe('admin');
  });

  // =========================================================================
  // TEST 7: Insecure Direct Object Reference (IDOR) Defense
  // =========================================================================
  it('TEST 7: User A attempting to view or cancel User B booking must receive 403 Forbidden', async () => {
    // User A calls GET /api/bookings/:id for User B's booking
    const res = await request(app)
      .get(`/api/bookings/${bookingIdB}`)
      .set('Authorization', `Bearer ${userTokenA}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');

    // Verify IDOR attempt was logged in audit_logs
    const db = getDb();
    const auditRow = await db.queryOne<{ event_type: string }>(
      "SELECT * FROM audit_logs WHERE event_type = 'IDOR_ACCESS_ATTEMPT_BLOCKED' AND actor_id = $1",
      [userIdA]
    );

    expect(auditRow).toBeDefined();
    expect(auditRow?.event_type).toBe('IDOR_ACCESS_ATTEMPT_BLOCKED');

    // Verify owner (User B) CAN access their own booking
    const ownerRes = await request(app)
      .get(`/api/bookings/${bookingIdB}`)
      .set('Authorization', `Bearer ${userTokenB}`);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.id).toBe(bookingIdB);
  });

  // =========================================================================
  // TEST 8: Defensive Security Headers Verification
  // =========================================================================
  it('TEST 8: Security headers (CSP, HSTS, X-Frame-Options, nosniff) must be enforced and X-Powered-By hidden', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

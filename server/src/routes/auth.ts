import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { env } from '../config/env.js';
import {
  registerSchema,
  loginSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
} from '../validators/index.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../security/passwords.js';
import {
  generateAccessToken,
  generatePreAuthToken,
  verifyPreAuthToken,
  getJwks,
} from '../security/jwt.js';
import {
  generateOpaqueToken,
  hashToken,
  revokeJti,
} from '../security/tokens.js';
import {
  generateMfaSetup,
  verifyTotpToken,
  verifyAndConsumeBackupCode,
} from '../security/mfa.js';
import { logAuditEvent } from '../logging/audit.js';
import {
  checkFailedLoginAlert,
  alertRefreshTokenReuse,
} from '../services/alerts.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { User } from '../types/index.js';

export const authRouter = Router();

// JWKS endpoints
authRouter.get('/jwks', (_req, res) => {
  res.json(getJwks());
});

/**
 * POST /api/auth/register
 */
authRouter.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid registration details',
      details: parseResult.error.format(),
      requestId,
    });
    return;
  }

  const { email, password, fullName, role } = parseResult.data;

  // Validate NIST password requirements
  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    res.status(400).json({
      error: `Password does not meet security requirements: ${passwordCheck.errors.join('. ')}`,
      details: passwordCheck.errors,
      requestId,
    });
    return;
  }

  const db = getDb();

  // Check existing user via parameterized query
  const existing = await db.queryOne<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing) {
    // Avoid leaking exact existence info directly in public response if necessary, or return clean message
    res.status(409).json({
      error: 'An account with this email address already exists.',
      requestId,
    });
    return;
  }

  const userId = uuidv4();
  const profileId = uuidv4();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  // Insert user
  await db.execute(
    `INSERT INTO users (
      id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6)`,
    [userId, email, passwordHash, role, now, now]
  );

  // Insert profile
  await db.execute(
    `INSERT INTO profiles (
      id, user_id, full_name, favorite_sports, skill_levels, games_played, rating, created_at
    ) VALUES ($1, $2, $3, '[]', '{}', 0, 5.0, $4)`,
    [profileId, userId, fullName, now]
  );

  await logAuditEvent({
    event_type: 'USER_REGISTERED',
    severity: 'INFO',
    actor_id: userId,
    actor_role: role,
    ip_address: clientIp,
    user_agent: userAgent,
    resource: '/api/auth/register',
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { email, role },
  });

  res.status(201).json({
    message: 'User registered successfully. You may now log in.',
    userId,
    requestId,
  });
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid email or password format', requestId });
    return;
  }

  const { email, password } = parseResult.data;
  const db = getDb();

  const user = await db.queryOne<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  // Check account lockout if user exists
  if (user && user.lockout_until) {
    const lockoutExpiry = new Date(user.lockout_until).getTime();
    if (Date.now() < lockoutExpiry) {
      const remainingMinutes = Math.ceil((lockoutExpiry - Date.now()) / (60 * 1000));
      
      await logAuditEvent({
        event_type: 'AUTH_LOCKED_ACCOUNT_ATTEMPT',
        severity: 'WARNING',
        actor_id: user.id,
        actor_role: user.role,
        ip_address: clientIp,
        user_agent: userAgent,
        resource: '/api/auth/login',
        action: 'POST',
        outcome: 'BLOCKED',
        request_id: requestId,
        details: { email, lockoutExpiry: user.lockout_until },
      });

      res.status(423).json({
        error: `Account is temporarily locked due to repeated failed logins. Please try again in ${remainingMinutes} minutes.`,
        requestId,
      });
      return;
    } else {
      // Lockout expired, reset attempts
      await db.execute(
        'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1',
        [user.id]
      );
    }
  }

  // Verify password with dummy check if user not found to prevent timing enumeration
  let passwordMatches = false;
  if (user) {
    passwordMatches = await verifyPassword(password, user.password_hash);
  } else {
    // Constant-time dummy verification
    await verifyPassword(password, '$2a$12$e8rO2e6q5p3G8S9X0V1Kz.uH4Y6w5z9w8e7r6t5y4u3i2o1p0a9s');
  }

  if (!user || !passwordMatches) {
    const timestamp = new Date().toISOString();

    // Record failed login attempt
    await db.execute(
      `INSERT INTO login_attempts (id, timestamp, email, ip_address, success, failure_reason)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [uuidv4(), timestamp, email, clientIp, 'INVALID_CREDENTIALS']
    );

    if (user) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      let lockoutDate: string | null = null;

      if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
        lockoutDate = new Date(Date.now() + env.LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
        await db.execute(
          'UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3',
          [attempts, lockoutDate, user.id]
        );

        await logAuditEvent({
          event_type: 'AUTH_ACCOUNT_LOCKED',
          severity: 'HIGH',
          actor_id: user.id,
          actor_role: user.role,
          ip_address: clientIp,
          user_agent: userAgent,
          resource: '/api/auth/login',
          action: 'POST',
          outcome: 'BLOCKED',
          request_id: requestId,
          details: { email, attempts, lockoutDuration: env.LOCKOUT_DURATION_MINUTES },
        });
      } else {
        await db.execute(
          'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
          [attempts, user.id]
        );
      }
    }

    await logAuditEvent({
      event_type: 'AUTH_LOGIN_FAILED',
      severity: 'WARNING',
      ip_address: clientIp,
      user_agent: userAgent,
      resource: '/api/auth/login',
      action: 'POST',
      outcome: 'FAILURE',
      request_id: requestId,
      details: { email },
    });

    await checkFailedLoginAlert(email, clientIp);

    // Uniform generic message preventing account enumeration
    res.status(401).json({
      error: 'Invalid email or password.',
      requestId,
    });
    return;
  }

  // Password matched: reset failed login attempts
  await db.execute(
    'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1',
    [user.id]
  );

  // Check if MFA is required (mandatory for admin or if user enabled MFA)
  const isMfaRequired = user.role === 'admin' || user.mfa_enabled === 1 || user.mfa_enabled === true;

  if (isMfaRequired) {
    const preAuthToken = generatePreAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await logAuditEvent({
      event_type: 'AUTH_MFA_CHALLENGE_ISSUED',
      severity: 'INFO',
      actor_id: user.id,
      actor_role: user.role,
      ip_address: clientIp,
      user_agent: userAgent,
      resource: '/api/auth/login',
      action: 'POST',
      outcome: 'SUCCESS',
      request_id: requestId,
      details: { email: user.email },
    });

    res.json({
      requireMfa: true,
      preAuthToken,
      message: 'MFA verification required to complete login.',
      requestId,
    });
    return;
  }

  // Issue full session tokens
  await issueSessionTokens(user, req, res, requestId);
});

/**
 * POST /api/auth/mfa/challenge
 */
authRouter.post('/mfa/challenge', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const parseResult = mfaChallengeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid MFA challenge payload', requestId });
    return;
  }

  const { preAuthToken, code } = parseResult.data;

  try {
    const preAuth = verifyPreAuthToken(preAuthToken);
    const db = getDb();

    const user = await db.queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [preAuth.sub]
    );

    if (!user || !user.mfa_secret) {
      res.status(401).json({ error: 'MFA configuration not found for user', requestId });
      return;
    }

    // Check TOTP token
    let mfaValid = verifyTotpToken(code, user.mfa_secret);

    // If TOTP check failed and code is 8 chars, check single-use backup codes
    if (!mfaValid && code.length === 8 && user.backup_codes) {
      try {
        const hashedCodes = JSON.parse(user.backup_codes) as string[];
        const matchIdx = await verifyAndConsumeBackupCode(code, hashedCodes);
        if (matchIdx !== -1) {
          mfaValid = true;
          // Consume code
          hashedCodes.splice(matchIdx, 1);
          await db.execute('UPDATE users SET backup_codes = $1 WHERE id = $2', [
            JSON.stringify(hashedCodes),
            user.id,
          ]);

          await logAuditEvent({
            event_type: 'AUTH_MFA_BACKUP_CODE_CONSUMED',
            severity: 'WARNING',
            actor_id: user.id,
            actor_role: user.role,
            ip_address: clientIp,
            user_agent: userAgent,
            resource: '/api/auth/mfa/challenge',
            action: 'POST',
            outcome: 'SUCCESS',
            request_id: requestId,
            details: { remainingBackupCodes: hashedCodes.length },
          });
        }
      } catch (err) {
        console.error('Backup code parse error:', err);
      }
    }

    if (!mfaValid) {
      await logAuditEvent({
        event_type: 'AUTH_MFA_FAILED',
        severity: 'WARNING',
        actor_id: user.id,
        actor_role: user.role,
        ip_address: clientIp,
        user_agent: userAgent,
        resource: '/api/auth/mfa/challenge',
        action: 'POST',
        outcome: 'FAILURE',
        request_id: requestId,
        details: { email: user.email },
      });

      res.status(401).json({ error: 'Invalid MFA verification code.', requestId });
      return;
    }

    await logAuditEvent({
      event_type: 'AUTH_MFA_SUCCESS',
      severity: 'INFO',
      actor_id: user.id,
      actor_role: user.role,
      ip_address: clientIp,
      user_agent: userAgent,
      resource: '/api/auth/mfa/challenge',
      action: 'POST',
      outcome: 'SUCCESS',
      request_id: requestId,
      details: { email: user.email },
    });

    await issueSessionTokens(user, req, res, requestId);
  } catch {
    res.status(401).json({ error: 'Expired or invalid pre-auth token', requestId });
  }
});

/**
 * POST /api/auth/mfa/enroll
 */
authRouter.post('/mfa/enroll', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const setup = await generateMfaSetup(user.email);
  const db = getDb();

  // Temporarily stage secret
  await db.execute('UPDATE users SET mfa_secret = $1 WHERE id = $2', [setup.secret, user.sub]);

  res.json({
    secret: setup.secret,
    otpauthUrl: setup.otpauthUrl,
    qrCodeDataUrl: setup.qrCodeDataUrl,
    backupCodes: setup.backupCodes,
    hashedBackupCodes: setup.hashedBackupCodes,
  });
});

/**
 * POST /api/auth/mfa/confirm
 */
authRouter.post('/mfa/confirm', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const parseResult = mfaVerifySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid 6-digit code', requestId });
    return;
  }

  const { code } = parseResult.data;
  const db = getDb();

  const userRow = await db.queryOne<User>('SELECT * FROM users WHERE id = $1', [user.sub]);
  if (!userRow || !userRow.mfa_secret) {
    res.status(400).json({ error: 'MFA enrollment not initiated', requestId });
    return;
  }

  const isValid = verifyTotpToken(code, userRow.mfa_secret);
  if (!isValid) {
    res.status(400).json({ error: 'Invalid verification code. Please try again.', requestId });
    return;
  }

  // Backup codes passed from client or generated
  const backupCodes = (req.body.hashedBackupCodes as string[]) || [];

  await db.execute(
    'UPDATE users SET mfa_enabled = 1, backup_codes = $1 WHERE id = $2',
    [JSON.stringify(backupCodes), user.sub]
  );

  await logAuditEvent({
    event_type: 'MFA_ENROLLED_SUCCESSFULLY',
    severity: 'INFO',
    actor_id: user.sub,
    actor_role: user.role,
    ip_address: clientIp,
    user_agent: userAgent,
    resource: '/api/auth/mfa/confirm',
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { email: user.email },
  });

  res.json({ message: 'MFA has been successfully configured and activated.', requestId });
});

/**
 * POST /api/auth/refresh
 */
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Read refresh token from HttpOnly cookie
  const incomingToken = req.cookies?.refreshToken;

  if (!incomingToken) {
    res.status(401).json({ error: 'Missing refresh token cookie', requestId });
    return;
  }

  const tokenHash = hashToken(incomingToken);
  const db = getDb();

  const existingToken = await db.queryOne<{
    id: string;
    user_id: string;
    family_id: string;
    is_revoked: number;
    expires_at: string;
  }>('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

  if (!existingToken) {
    res.status(401).json({ error: 'Invalid refresh token', requestId });
    return;
  }

  // REUSE DETECTION: If this token was already revoked, someone is replaying it!
  if (existingToken.is_revoked === 1) {
    // Revoke the entire token family immediately
    await db.execute('UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = $1', [
      existingToken.family_id,
    ]);

    await logAuditEvent({
      event_type: 'REFRESH_TOKEN_REUSE_ATTEMPT',
      severity: 'CRITICAL',
      actor_id: existingToken.user_id,
      ip_address: clientIp,
      user_agent: userAgent,
      resource: '/api/auth/refresh',
      action: 'POST',
      outcome: 'BLOCKED',
      request_id: requestId,
      details: { family_id: existingToken.family_id },
    });

    await alertRefreshTokenReuse(existingToken.family_id, existingToken.user_id, clientIp);

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({
      error: 'Security alert: Refresh token reuse detected. All sessions revoked.',
      requestId,
    });
    return;
  }

  // Check expiration
  if (new Date(existingToken.expires_at).getTime() < Date.now()) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(401).json({ error: 'Refresh token expired. Please log in again.', requestId });
    return;
  }

  // Revoke the used token (single-use rotation)
  await db.execute('UPDATE refresh_tokens SET is_revoked = 1 WHERE id = $1', [existingToken.id]);

  // Retrieve user for role & email
  const user = await db.queryOne<User>('SELECT * FROM users WHERE id = $1', [existingToken.user_id]);
  if (!user) {
    res.status(401).json({ error: 'User not found', requestId });
    return;
  }

  // Issue new access token and rotated refresh token in the same family
  const newAccessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const newOpaqueToken = generateOpaqueToken();
  const newTokenHash = hashToken(newOpaqueToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.JWT_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.execute(
    `INSERT INTO refresh_tokens (
      id, user_id, token_hash, family_id, is_revoked, expires_at, created_ip, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8)`,
    [
      uuidv4(),
      user.id,
      newTokenHash,
      existingToken.family_id,
      expiresAt,
      clientIp,
      userAgent,
      now.toISOString(),
    ]
  );

  // Set rotated HttpOnly; Secure; SameSite=Strict cookie
  res.cookie('refreshToken', newOpaqueToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken: newAccessToken,
    requestId,
  });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const incomingToken = req.cookies?.refreshToken;
  const db = getDb();

  if (incomingToken) {
    const tokenHash = hashToken(incomingToken);
    const existing = await db.queryOne<{ family_id: string; user_id: string }>(
      'SELECT family_id, user_id FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (existing) {
      await db.execute('UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = $1', [
        existing.family_id,
      ]);

      await logAuditEvent({
        event_type: 'AUTH_LOGOUT',
        severity: 'INFO',
        actor_id: existing.user_id,
        ip_address: clientIp,
        user_agent: userAgent,
        resource: '/api/auth/logout',
        action: 'POST',
        outcome: 'SUCCESS',
        request_id: requestId,
        details: { family_id: existing.family_id },
      });
    }
  }

  // Blacklist JTI if access token provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = req.user;
      if (decoded?.jti) {
        revokeJti(decoded.jti);
      }
    } catch {
      // Ignore token parse error during logout
    }
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out successfully', requestId });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const user = await db.queryOne<User>(
    'SELECT id, email, role, mfa_enabled, created_at FROM users WHERE id = $1',
    [req.user!.sub]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const profile = await db.queryOne(
    'SELECT * FROM profiles WHERE user_id = $1',
    [user.id]
  );

  res.json({
    user: {
      ...user,
      mfa_enabled: Boolean(user.mfa_enabled),
    },
    profile,
  });
});

/**
 * Helper to issue session tokens upon successful authentication.
 */
async function issueSessionTokens(
  user: User,
  req: Request,
  res: Response,
  requestId: string
): Promise<void> {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const db = getDb();

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const rawRefreshToken = generateOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const familyId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.JWT_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.execute(
    `INSERT INTO refresh_tokens (
      id, user_id, token_hash, family_id, is_revoked, expires_at, created_ip, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8)`,
    [
      uuidv4(),
      user.id,
      tokenHash,
      familyId,
      expiresAt,
      clientIp,
      userAgent,
      now.toISOString(),
    ]
  );

  // Record successful login
  await db.execute(
    `INSERT INTO login_attempts (id, timestamp, email, ip_address, success)
     VALUES ($1, $2, $3, $4, 1)`,
    [uuidv4(), now.toISOString(), user.email, clientIp]
  );

  await logAuditEvent({
    event_type: 'AUTH_LOGIN_SUCCESS',
    severity: 'INFO',
    actor_id: user.id,
    actor_role: user.role,
    ip_address: clientIp,
    user_agent: userAgent,
    resource: '/api/auth/login',
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { email: user.email, role: user.role },
  });

  // Set secure HttpOnly cookie scoped to /api/auth
  res.cookie('refreshToken', rawRefreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.JWT_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      mfa_enabled: Boolean(user.mfa_enabled),
    },
    requestId,
  });
}

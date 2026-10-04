import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { exportLimiter } from '../middleware/rate-limit.js';
import { logAuditEvent, verifyAuditLogIntegrity } from '../logging/audit.js';
import { checkDataExportAlert } from '../services/alerts.js';
import { updateUserRoleSchema, updateUserLockSchema } from '../validators/index.js';
import { User, AuditLogEntry, SecurityAlert } from '../types/index.js';

export const adminRouter = Router();

// Apply requireAuth and requireAdmin to all /api/admin routes
adminRouter.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/users (List all registered users)
 */
adminRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const users = await db.query<User>(
    `SELECT u.id, u.email, u.role, u.mfa_enabled, u.failed_login_attempts, u.lockout_until, u.created_at,
            p.full_name, p.rating, p.games_played
     FROM users u
     LEFT JOIN profiles p ON u.id = p.user_id
     ORDER BY u.created_at DESC`
  );

  const sanitizedUsers = users.rows.map((u) => ({
    ...u,
    mfa_enabled: Boolean(u.mfa_enabled),
    is_locked: u.lockout_until ? new Date(u.lockout_until).getTime() > Date.now() : false,
  }));

  res.json({ users: sanitizedUsers });
});

/**
 * PUT /api/admin/users/:id/role (Change user role)
 */
adminRouter.put('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const requestId = req.requestId || 'req-' + Date.now();
  const parseResult = updateUserRoleSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid role specified', details: parseResult.error.format() });
    return;
  }

  const { role } = parseResult.data;
  const db = getDb();

  const user = await db.queryOne<User>('SELECT id, email, role FROM users WHERE id = $1', [id]);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  await db.execute('UPDATE users SET role = $1, updated_at = $2 WHERE id = $3', [
    role,
    new Date().toISOString(),
    id,
  ]);

  await logAuditEvent({
    event_type: 'USER_ROLE_CHANGED',
    severity: 'WARNING',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/admin/users/${id}/role`,
    action: 'PUT',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: {
      targetUserId: id,
      previousRole: user.role,
      newRole: role,
    },
  });

  res.json({ message: `Role for user ${user.email} updated to ${role}.` });
});

/**
 * PUT /api/admin/users/:id/lock (Lock or unlock user account)
 */
adminRouter.put('/users/:id/lock', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const requestId = req.requestId || 'req-' + Date.now();
  const parseResult = updateUserLockSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid lock parameters', details: parseResult.error.format() });
    return;
  }

  const { locked, durationMinutes } = parseResult.data;
  const db = getDb();

  const user = await db.queryOne<User>('SELECT id, email FROM users WHERE id = $1', [id]);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  let lockoutUntil: string | null = null;
  if (locked) {
    const mins = durationMinutes || 60;
    lockoutUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();
  }

  await db.execute(
    'UPDATE users SET lockout_until = $1, failed_login_attempts = 0, updated_at = $2 WHERE id = $3',
    [lockoutUntil, new Date().toISOString(), id]
  );

  await logAuditEvent({
    event_type: locked ? 'ADMIN_LOCKED_USER' : 'ADMIN_UNLOCKED_USER',
    severity: 'WARNING',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/admin/users/${id}/lock`,
    action: 'PUT',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { targetUserId: id, locked, lockoutUntil },
  });

  res.json({
    message: locked
      ? `User account has been locked until ${lockoutUntil}.`
      : 'User account has been unlocked.',
  });
});

/**
 * GET /api/admin/audit-logs (View tamper-evident audit logs & verify hash integrity)
 */
adminRouter.get('/audit-logs', async (_req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const logs = await db.query<AuditLogEntry>(
    'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100'
  );

  const integrity = await verifyAuditLogIntegrity();

  const formattedLogs = logs.rows.map((l) => ({
    ...l,
    details: typeof l.details === 'string' ? JSON.parse(l.details) : l.details,
  }));

  res.json({
    logs: formattedLogs,
    integrity,
  });
});

/**
 * GET /api/admin/security-alerts (View security detection alerts)
 */
adminRouter.get('/security-alerts', async (_req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const alerts = await db.query<SecurityAlert>(
    'SELECT * FROM security_alerts ORDER BY timestamp DESC LIMIT 100'
  );

  const formattedAlerts = alerts.rows.map((a) => ({
    ...a,
    metadata: typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata,
  }));

  res.json({ alerts: formattedAlerts });
});

/**
 * PUT /api/admin/security-alerts/:id/ack (Acknowledge alert)
 */
adminRouter.put('/security-alerts/:id/ack', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  await db.execute(
    "UPDATE security_alerts SET status = 'ACKNOWLEDGED' WHERE id = $1",
    [id]
  );

  res.json({ message: 'Alert acknowledged' });
});

/**
 * POST /api/admin/export (Demonstrable data export with rate limiting & alert triggers)
 */
adminRouter.post('/export', exportLimiter, async (req: Request, res: Response): Promise<void> => {
  const { resource = 'users' } = req.body;
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || 'unknown';
  const db = getDb();

  let csvContent = '';
  let rowCount = 0;

  if (resource === 'users') {
    const users = await db.query<User>(
      'SELECT id, email, role, mfa_enabled, created_at FROM users'
    );
    rowCount = users.rows.length;
    csvContent = 'id,email,role,mfa_enabled,created_at\n' +
      users.rows.map((u) => `${u.id},${u.email},${u.role},${u.mfa_enabled},${u.created_at}`).join('\n');
  } else if (resource === 'bookings') {
    const bookings = await db.query<Booking>(
      'SELECT id, user_id, venue_id, date, start_time, end_time, total_price, status FROM bookings'
    );
    rowCount = bookings.rows.length;
    csvContent = 'id,user_id,venue_id,date,start_time,end_time,total_price,status\n' +
      bookings.rows.map((b: Booking) => `${b.id},${b.user_id},${b.venue_id},${b.date},${b.start_time},${b.end_time},${b.total_price},${b.status}`).join('\n');
  } else {
    const logs = await db.query<AuditLogEntry>(
      'SELECT id, timestamp, event_type, severity, ip_address, outcome, hash FROM audit_logs LIMIT 500'
    );
    rowCount = logs.rows.length;
    csvContent = 'id,timestamp,event_type,severity,ip_address,outcome,hash\n' +
      logs.rows.map((l) => `${l.id},${l.timestamp},${l.event_type},${l.severity},${l.ip_address},${l.outcome},${l.hash}`).join('\n');
  }

  // Audit this data export event
  await logAuditEvent({
    event_type: 'DATA_EXPORT_PERFORMED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: clientIp,
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/admin/export?resource=${resource}`,
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { resource, rowCount },
  });

  // Check if volume triggers data export threshold alert
  await checkDataExportAlert(req.user!.sub, rowCount, clientIp, resource);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="export-${resource}-${Date.now()}.csv"`);
  res.status(200).send(csvContent);
});

/**
 * PUT /api/admin/config (Configuration changes auditing)
 */
adminRouter.put('/config', async (req: Request, res: Response): Promise<void> => {
  const { key, value } = req.body;
  const requestId = req.requestId || 'req-' + Date.now();
  const db = getDb();
  const now = new Date().toISOString();

  if (!key || typeof value !== 'string') {
    res.status(400).json({ error: 'Key and value string required' });
    return;
  }

  await db.execute(
    `INSERT INTO app_config (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_by = $3, updated_at = $4`,
    [key, value, req.user!.sub, now]
  );

  await logAuditEvent({
    event_type: 'CONFIGURATION_CHANGED',
    severity: 'WARNING',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/admin/config/${key}`,
    action: 'PUT',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { configKey: key, configValue: value },
  });

  res.json({ message: `Configuration '${key}' updated successfully.` });
});

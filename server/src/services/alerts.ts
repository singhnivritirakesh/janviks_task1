import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { env } from '../config/env.js';
import { SecurityAlert } from '../types/index.js';

export interface TriggerAlertParams {
  alert_type: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  source_ip: string;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createSecurityAlert(params: TriggerAlertParams): Promise<SecurityAlert> {
  const db = getDb();
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  const metadataJson = JSON.stringify(params.metadata || {});

  const alert: SecurityAlert = {
    id,
    timestamp,
    alert_type: params.alert_type,
    severity: params.severity,
    description: params.description,
    source_ip: params.source_ip,
    user_id: params.user_id || null,
    metadata: params.metadata || null,
    status: 'NEW',
    resolved_at: null,
  };

  // Structured logging for SOC/SIEM alerting
  console.warn(JSON.stringify({ tag: 'SECURITY_ALERT', ...alert }));

  await db.execute(
    `INSERT INTO security_alerts (
      id, timestamp, alert_type, severity, description, source_ip, user_id, metadata, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      timestamp,
      params.alert_type,
      params.severity,
      params.description,
      params.source_ip,
      params.user_id || null,
      metadataJson,
      'NEW',
    ]
  );

  return alert;
}

/**
 * Detection Rule 1: Check for repeated failed logins (same email or IP).
 */
export async function checkFailedLoginAlert(email: string, ip: string): Promise<void> {
  const db = getDb();
  const windowMinutes = env.ALERT_FAILED_LOGIN_WINDOW_MINUTES;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // 1. By email
  const emailRes = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts 
     WHERE email = $1 AND success = 0 AND timestamp >= $2`,
    [email, cutoff]
  );

  const emailFailures = emailRes?.count ?? 0;
  if (emailFailures >= env.ALERT_FAILED_LOGIN_THRESHOLD) {
    await createSecurityAlert({
      alert_type: 'BRUTE_FORCE_ACCOUNT_TARGETED',
      severity: 'HIGH',
      description: `Detected ${emailFailures} consecutive failed login attempts targeting account '${email}' within ${windowMinutes} minutes.`,
      source_ip: ip,
      metadata: { email, failedAttempts: emailFailures, windowMinutes },
    });
  }

  // 2. By IP
  const ipRes = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM login_attempts 
     WHERE ip_address = $1 AND success = 0 AND timestamp >= $2`,
    [ip, cutoff]
  );

  const ipFailures = ipRes?.count ?? 0;
  if (ipFailures >= env.ALERT_FAILED_LOGIN_THRESHOLD * 2) {
    await createSecurityAlert({
      alert_type: 'CREDENTIAL_STUFFING_IP_BURST',
      severity: 'CRITICAL',
      description: `Detected ${ipFailures} failed login attempts originating from IP '${ip}' across multiple accounts.`,
      source_ip: ip,
      metadata: { source_ip: ip, failedAttempts: ipFailures, windowMinutes },
    });
  }
}

/**
 * Detection Rule 2: Repeated 401/403 authorization failures.
 */
export async function checkUnauthorizedAttemptsAlert(ip: string, userId?: string): Promise<void> {
  const db = getDb();
  const windowMinutes = env.ALERT_UNAUTHORIZED_WINDOW_MINUTES;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const res = await db.queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_logs 
     WHERE (ip_address = $1 OR actor_id = $2) 
     AND outcome = 'BLOCKED' 
     AND timestamp >= $3`,
    [ip, userId || '', cutoff]
  );

  const count = res?.count ?? 0;
  if (count >= env.ALERT_UNAUTHORIZED_THRESHOLD) {
    await createSecurityAlert({
      alert_type: 'REPEATED_AUTHORIZATION_FAILURES',
      severity: 'HIGH',
      description: `Observed ${count} unauthorized or forbidden requests from IP ${ip} (user: ${userId || 'anonymous'}) in ${windowMinutes} minutes.`,
      source_ip: ip,
      user_id: userId,
      metadata: { unauthorizedCount: count, windowMinutes },
    });
  }
}

/**
 * Detection Rule 3: Refresh Token Reuse Detection.
 */
export async function alertRefreshTokenReuse(
  familyId: string,
  userId: string,
  ip: string
): Promise<void> {
  await createSecurityAlert({
    alert_type: 'REFRESH_TOKEN_REUSE_DETECTED',
    severity: 'CRITICAL',
    description: `A previously revoked refresh token in family '${familyId}' was presented for exchange. Token family invalidated immediately. Potential session hijacking.`,
    source_ip: ip,
    user_id: userId,
    metadata: { familyId, securityAction: 'REVOKE_ALL_FAMILY_TOKENS' },
  });
}

/**
 * Detection Rule 4: Excessive Data Export.
 */
export async function checkDataExportAlert(
  userId: string,
  recordCount: number,
  ip: string,
  resource: string
): Promise<void> {
  if (recordCount >= env.ALERT_DATA_EXPORT_THRESHOLD) {
    await createSecurityAlert({
      alert_type: 'UNUSUAL_DATA_EXPORT_VOLUME',
      severity: 'MEDIUM',
      description: `User ${userId} exported ${recordCount} records from '${resource}'. Exceeds audit alert threshold (${env.ALERT_DATA_EXPORT_THRESHOLD}).`,
      source_ip: ip,
      user_id: userId,
      metadata: { recordCount, resource, threshold: env.ALERT_DATA_EXPORT_THRESHOLD },
    });
  }
}

/**
 * Detection Rule 5: Privilege Escalation Attempt.
 */
export async function alertPrivilegeEscalation(
  userId: string,
  role: string,
  targetEndpoint: string,
  ip: string
): Promise<void> {
  await createSecurityAlert({
    alert_type: 'PRIVILEGE_ESCALATION_ATTEMPT',
    severity: 'HIGH',
    description: `User '${userId}' with role '${role}' attempted to access privileged administrator endpoint '${targetEndpoint}'.`,
    source_ip: ip,
    user_id: userId,
    metadata: { role, targetEndpoint },
  });
}

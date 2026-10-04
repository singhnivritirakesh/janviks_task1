import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { AuditLogEntry, AuditSeverity } from '../types/index.js';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
let lastKnownHash = GENESIS_HASH;

/**
 * Initializes the audit hash chain by retrieving the most recent log's hash.
 */
export async function initAuditHashChain(): Promise<void> {
  const db = getDb();
  try {
    const lastRow = await db.queryOne<{ hash: string }>(
      'SELECT hash FROM audit_logs ORDER BY timestamp DESC LIMIT 1'
    );
    if (lastRow && lastRow.hash) {
      lastKnownHash = lastRow.hash;
    } else {
      lastKnownHash = GENESIS_HASH;
    }
  } catch {
    lastKnownHash = GENESIS_HASH;
  }
}

/**
 * Sanitize details object to strictly exclude passwords, tokens, secrets.
 */
function sanitizeDetails(details?: Record<string, unknown> | null): Record<string, unknown> {
  if (!details) return {};
  const sanitized: Record<string, unknown> = {};
  const forbiddenKeys = ['password', 'token', 'secret', 'mfa_secret', 'refresh_token', 'access_token', 'authorization'];

  for (const [key, value] of Object.entries(details)) {
    if (forbiddenKeys.some((f) => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED_SECRET]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface CreateAuditLogParams {
  event_type: string;
  severity: AuditSeverity;
  actor_id?: string | null;
  actor_role?: string | null;
  ip_address: string;
  user_agent: string;
  resource: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  request_id: string;
  details?: Record<string, unknown> | null;
}

/**
 * Records a cryptographically tamper-evident audit log entry.
 */
export async function logAuditEvent(params: CreateAuditLogParams): Promise<AuditLogEntry> {
  const db = getDb();
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  const cleanDetails = sanitizeDetails(params.details);
  const detailsJson = JSON.stringify(cleanDetails);

  const prev_hash = lastKnownHash;

  // Compute SHA-256 tamper-evident chain hash
  const payloadToHash = `${prev_hash}|${timestamp}|${params.event_type}|${params.severity}|${params.actor_id || ''}|${params.resource}|${params.action}|${params.outcome}|${detailsJson}`;
  const hash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

  lastKnownHash = hash;

  const entry: AuditLogEntry = {
    id,
    timestamp,
    event_type: params.event_type,
    severity: params.severity,
    actor_id: params.actor_id || null,
    actor_role: params.actor_role || null,
    ip_address: params.ip_address,
    user_agent: params.user_agent,
    resource: params.resource,
    action: params.action,
    outcome: params.outcome,
    request_id: params.request_id,
    details: cleanDetails,
    prev_hash,
    hash,
  };

  // 1. Structured JSON output for SIEM shipping / stdout
  console.log(JSON.stringify({ tag: 'AUDIT_LOG', ...entry }));

  // 2. Append-only database persistence
  await db.execute(
    `INSERT INTO audit_logs (
      id, timestamp, event_type, severity, actor_id, actor_role,
      ip_address, user_agent, resource, action, outcome, request_id,
      details, prev_hash, hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      timestamp,
      params.event_type,
      params.severity,
      params.actor_id || null,
      params.actor_role || null,
      params.ip_address,
      params.user_agent,
      params.resource,
      params.action,
      params.outcome,
      params.request_id,
      detailsJson,
      prev_hash,
      hash,
    ]
  );

  return entry;
}

/**
 * Validates the cryptographic tamper-evidence of the entire audit trail.
 */
export async function verifyAuditLogIntegrity(): Promise<{
  valid: boolean;
  totalEntries: number;
  corruptedAt?: string;
}> {
  const db = getDb();
  const logs = await db.query<AuditLogEntry>(
    'SELECT * FROM audit_logs ORDER BY timestamp ASC'
  );

  let currentExpectedPrev = GENESIS_HASH;

  for (let i = 0; i < logs.rows.length; i++) {
    const entry = logs.rows[i];

    if (entry.prev_hash !== currentExpectedPrev) {
      return {
        valid: false,
        totalEntries: logs.rows.length,
        corruptedAt: entry.id,
      };
    }

    const detailsJson = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details || {});
    const payloadToHash = `${entry.prev_hash}|${entry.timestamp}|${entry.event_type}|${entry.severity}|${entry.actor_id || ''}|${entry.resource}|${entry.action}|${entry.outcome}|${detailsJson}`;
    const calculatedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    if (calculatedHash !== entry.hash) {
      return {
        valid: false,
        totalEntries: logs.rows.length,
        corruptedAt: entry.id,
      };
    }

    currentExpectedPrev = entry.hash;
  }

  return {
    valid: true,
    totalEntries: logs.rows.length,
  };
}

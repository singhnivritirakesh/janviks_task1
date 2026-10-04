import crypto from 'crypto';

/**
 * Generates an opaque, cryptographically secure 256-bit random string.
 */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes SHA-256 hash of an opaque token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * In-memory revoked access token JTI cache (also backed by database table).
 */
const revokedJtis = new Set<string>();

export function revokeJti(jti: string): void {
  revokedJtis.add(jti);
}

export function isJtiRevoked(jti: string): boolean {
  return revokedJtis.has(jti);
}

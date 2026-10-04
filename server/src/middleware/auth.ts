import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../security/jwt.js';
import { isJtiRevoked } from '../security/tokens.js';
import { logAuditEvent } from '../logging/audit.js';
import { alertPrivilegeEscalation, checkUnauthorizedAttemptsAlert } from '../services/alerts.js';
import { JWTPayload, UserRole } from '../types/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      requestId?: string;
    }
  }
}

/**
 * Middleware: Requires a valid, active RS256 access token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logAuditEvent({
      event_type: 'AUTH_MISSING_TOKEN',
      severity: 'WARNING',
      ip_address: clientIp,
      user_agent: userAgent,
      resource: req.originalUrl,
      action: req.method,
      outcome: 'BLOCKED',
      request_id: requestId,
      details: { reason: 'No Bearer token provided in Authorization header' },
    });

    await checkUnauthorizedAttemptsAlert(clientIp);

    res.status(401).json({
      error: 'Authentication required. Missing Bearer token.',
      requestId,
    });
    return;
  }

  const token = authHeader.substring(7).trim();

  try {
    const payload = verifyAccessToken(token);

    // Verify token is not blacklisted/revoked
    if (isJtiRevoked(payload.jti)) {
      await logAuditEvent({
        event_type: 'AUTH_REVOKED_TOKEN_USED',
        severity: 'WARNING',
        actor_id: payload.sub,
        actor_role: payload.role,
        ip_address: clientIp,
        user_agent: userAgent,
        resource: req.originalUrl,
        action: req.method,
        outcome: 'BLOCKED',
        request_id: requestId,
        details: { jti: payload.jti },
      });

      res.status(401).json({
        error: 'Token has been revoked. Please log in again.',
        requestId,
      });
      return;
    }

    req.user = payload;
    next();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid token';

    await logAuditEvent({
      event_type: 'AUTH_INVALID_TOKEN',
      severity: 'WARNING',
      ip_address: clientIp,
      user_agent: userAgent,
      resource: req.originalUrl,
      action: req.method,
      outcome: 'BLOCKED',
      request_id: requestId,
      details: { error: errorMessage },
    });

    await checkUnauthorizedAttemptsAlert(clientIp);

    res.status(401).json({
      error: 'Invalid or expired token',
      requestId,
    });
  }
}

/**
 * Middleware: Role-Based Access Control (RBAC).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.requestId || 'req-' + Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required', requestId });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAuditEvent({
        event_type: 'RBAC_FORBIDDEN_ROLE_ATTEMPT',
        severity: 'WARNING',
        actor_id: req.user.sub,
        actor_role: req.user.role,
        ip_address: clientIp,
        user_agent: userAgent,
        resource: req.originalUrl,
        action: req.method,
        outcome: 'BLOCKED',
        request_id: requestId,
        details: {
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        },
      });

      // If non-admin attempted to hit an admin endpoint, alert privilege escalation
      if (allowedRoles.includes('admin') && req.user.role !== 'admin') {
        await alertPrivilegeEscalation(req.user.sub, req.user.role, req.originalUrl, clientIp);
      }

      await checkUnauthorizedAttemptsAlert(clientIp, req.user.sub);

      res.status(403).json({
        error: 'Forbidden: Insufficient privileges for this operation',
        requestId,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireVenueManager = requireRole('admin', 'venue_manager');

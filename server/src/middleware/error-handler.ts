import { Request, Response, NextFunction } from 'express';
import { logAuditEvent } from '../logging/audit.js';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export async function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const statusCode = err.statusCode || 500;
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Log full detailed error on the server side
  console.error(`❌ [${requestId}] Error handling ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: err.stack,
    details: err.details,
    ip: clientIp,
  });

  // Record 5xx server errors in the audit log
  if (statusCode >= 500) {
    await logAuditEvent({
      event_type: 'API_INTERNAL_ERROR',
      severity: 'ERROR',
      actor_id: req.user?.sub,
      actor_role: req.user?.role,
      ip_address: clientIp,
      user_agent: userAgent,
      resource: req.originalUrl,
      action: req.method,
      outcome: 'FAILURE',
      request_id: requestId,
      details: {
        errorMessage: err.message,
        statusCode,
      },
    });
  }

  // Sanitize client-facing response: never leak stack traces, database schema, or internal paths
  const clientResponse: { error: string; requestId: string; details?: unknown } = {
    error: statusCode === 500 ? 'An unexpected error occurred. Please try again later.' : err.message,
    requestId,
  };

  if (statusCode < 500 && err.details) {
    clientResponse.details = err.details;
  }

  res.status(statusCode).json(clientResponse);
}

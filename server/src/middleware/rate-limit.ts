import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { logAuditEvent } from '../logging/audit.js';

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.NODE_ENV === 'test' ? 10000 : env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  handler: async (req, res, _next, options) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await logAuditEvent({
      event_type: 'RATE_LIMIT_EXCEEDED_API',
      severity: 'WARNING',
      actor_id: req.user?.sub,
      ip_address: clientIp,
      user_agent: req.headers['user-agent'] || 'unknown',
      resource: req.originalUrl,
      action: req.method,
      outcome: 'BLOCKED',
      request_id: req.requestId || 'req-' + Date.now(),
      details: { limit: options.max, windowMs: options.windowMs },
    });

    res.status(429).json(options.message);
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 10, // Max 10 login/register attempts per IP in 15 mins in prod/dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  handler: async (req, res, _next, options) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await logAuditEvent({
      event_type: 'RATE_LIMIT_EXCEEDED_AUTH',
      severity: 'HIGH',
      ip_address: clientIp,
      user_agent: req.headers['user-agent'] || 'unknown',
      resource: req.originalUrl,
      action: req.method,
      outcome: 'BLOCKED',
      request_id: req.requestId || 'req-' + Date.now(),
      details: { ip: clientIp, limit: options.max },
    });

    res.status(429).json(options.message);
  },
});

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Data export rate limit reached. Maximum 5 exports per hour.',
  },
});

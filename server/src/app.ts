import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import { env } from './config/env.js';
import { securityHeadersMiddleware } from './middleware/security-headers.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { getJwks } from './security/jwt.js';

import { authRouter } from './routes/auth.js';
import { venuesRouter } from './routes/venues.js';
import { eventsRouter } from './routes/events.js';
import { bookingsRouter } from './routes/bookings.js';
import { playersRouter } from './routes/players.js';
import { adminRouter } from './routes/admin.js';

export function createApp(): express.Application {
  const app = express();

  // 1. Request ID correlation
  app.use((req: Request, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || uuidv4();
    req.requestId = reqId;
    res.setHeader('X-Request-ID', reqId);
    next();
  });

  // 2. Security Headers (Helmet, CSP, HSTS, X-Frame-Options)
  app.use(securityHeadersMiddleware);

  // 3. Strict CORS Configuration
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    })
  );

  // 4. Request Body Size Limits & Parsers
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // 5. Public Well-Known JWKS endpoint
  app.get('/.well-known/jwks.json', (_req, res) => {
    res.json(getJwks());
  });

  // 6. Rate Limiting for API routes
  app.use('/api', apiLimiter);

  // 7. Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 8. Mount Feature Routers
  app.use('/api/auth', authRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/admin', adminRouter);

  // 9. 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Endpoint not found',
      requestId: req.requestId,
    });
  });

  // 10. Centralized Error Handler (no stack leaks, generic messages)
  app.use(errorHandler);

  return app;
}

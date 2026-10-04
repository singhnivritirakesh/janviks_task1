import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export const securityHeadersMiddleware = [
  // 1. Helmet configuration with Strict CSP and hardening
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hidePoweredBy: true,
  }),

  // 2. Custom header enforcement (Permissions-Policy and Cache-Control for sensitive endpoints)
  (req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Never cache API responses containing sensitive user data
    if (req.originalUrl.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  },
];

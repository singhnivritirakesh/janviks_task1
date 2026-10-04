# Evidence 10: Defensive HTTP Security Headers & Information Leakage Mitigation

## Classification
- **CWE:** CWE-693: Protection Mechanism Failure, CWE-1021: Improper Restriction of Rendered UI Layers or Frames
- **OWASP Top 10:** A05:2021 – Security Misconfiguration

## Attack Scenario (Before Hardening)
In standard default deployments:
1. Missing `X-Frame-Options` and `frame-ancestors 'none'` permits clickjacking attacks, where an attacker embeds the application inside a transparent `<iframe>` on a malicious site, tricking users into confirming court bookings or modifying account settings.
2. Missing `X-Content-Type-Options: nosniff` allows MIME-type confusion attacks, causing browsers to execute user-uploaded files as JavaScript.
3. Exposing `X-Powered-By: Express` reveals exact backend technologies and frameworks, aiding attackers in targeted fingerprinting and exploit selection.
4. Missing HSTS enables SSL stripping attacks (Moxie Marlinspike's sslstrip), downgrading secure sessions to plaintext HTTP.

## Defensive Implementation
1. **Server-Level Helmet Middleware (`server/src/middleware/security-headers.ts`):**
```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.disable('x-powered-by');
```
2. **Reverse Proxy Hardening (`docker/nginx/nginx.conf`):**
   Nginx mirrors all defensive headers and enforces `server_tokens off;` to suppress Nginx version banners.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 8`):
1. Dispatches `GET /api/health` request.
2. Asserts response contains:
   - `x-frame-options: DENY`
   - `x-content-type-options: nosniff`
   - `strict-transport-security: max-age=31536000; includeSubDomains; preload`
   - `content-security-policy` contains `frame-ancestors 'none'`
   - `x-powered-by` header is completely `undefined`.

### Test Result
```
✓ TEST 8: Security headers (CSP, HSTS, X-Frame-Options, nosniff) must be enforced and X-Powered-By hidden (3ms)
```

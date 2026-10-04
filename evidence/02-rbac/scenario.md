# Evidence 02: Role-Based Access Control (RBAC) & Privilege Escalation Defense

## Classification
- **CWE:** CWE-285: Improper Authorization, CWE-862: Missing Authorization
- **OWASP Top 10:** A01:2021 – Broken Access Control

## Attack Scenario (Before Hardening)
In the original SPA implementation, role checks were performed primarily in React frontend components (`if (user.role === 'admin')`). An attacker logged in as a normal player (`role: 'user'`) could inspect network traffic, identify administrative API endpoints (such as user management, data export, or audit logs), and send requests directly using their session token. Without rigorous server-side role enforcement, the server would execute the request, allowing players to view all users, delete accounts, or export sensitive PII.

## Defensive Implementation
1. **Server-Side Middleware Role Enforcement:**
```typescript
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      logAuditEvent({
        event_type: 'RBAC_ACCESS_DENIED',
        severity: 'WARNING',
        actor_id: req.user.sub,
        actor_role: req.user.role,
        resource: req.originalUrl,
        action: req.method,
        outcome: 'BLOCKED',
      });
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
```
2. **Three Explicit Roles:**
   - `admin`: Full system governance, audit trail verification, security alert monitoring, user role modifications.
   - `venue_manager`: Venue management, court availability scheduling, venue booking oversight.
   - `user`: Booking court slots, joining community events, editing personal profile.
3. **Automated Security Alert on Repeated Failures:** `evaluateSecurityAlerts` tracks 401/403 events in a 5-minute sliding window; exceeding 5 blocked requests generates a `HIGH` severity alert `REPEATED_AUTHORIZATION_FAILURES`.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 2`) authenticates as User A (`role: 'user'`) and attempts to access `/api/admin/users`:
1. Request sent with User A's valid RS256 JWT.
2. Server verifies JWT signature, decodes payload, and checks role.
3. Because role `'user'` is not in `['admin']`, server halts request processing.
4. Server generates audit log entry and issues `403 Forbidden`.
5. Security alerts table is updated.

### Test Result
```
✓ TEST 2: Low-privileged user (player) calling admin endpoint must receive 403 Forbidden and trigger security alert (11ms)
```

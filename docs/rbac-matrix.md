# Role-Based Access Control (RBAC) & Authorization Matrix

This document provides a comprehensive authorization matrix for PlaySphere Connect, detailing role permissions, object-level access boundaries, and server-side enforcement mechanisms.

---

## 1. Role Hierarchy & Descriptions

| Role | Hierarchy Level | Description | Key Capabilities |
| :--- | :---: | :--- | :--- |
| **Anonymous (Guest)** | 0 | Unauthenticated visitor | Browse venues, view public community events, view JWKS keys, log in, register. |
| **Player (`user`)** | 1 | Standard authenticated athlete/member | Book court times, join/leave events, manage own user profile, enroll in personal MFA. |
| **Venue Manager (`venue_manager`)** | 2 | Verified facility operator | Create, edit, and archive owned venues; manage court slots; oversee facility bookings. |
| **Administrator (`admin`)** | 3 | Privileged platform operator | Full system governance, audit trail verification, security alert monitoring, user role modification, data export. **Mandatory MFA required.** |

---

## 2. Comprehensive Endpoint Authorization Matrix

| HTTP Method | Route Pattern | Minimum Role | Object Ownership Check | Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Public** | | | | |
| `GET` | `/.well-known/jwks.json` | `anonymous` | None | Public RSA-2048 JWKS key distribution |
| `GET` | `/api/health` | `anonymous` | None | Service liveness probe |
| `POST` | `/api/auth/register` | `anonymous` | None | Input validation (Zod), NIST password check |
| `POST` | `/api/auth/login` | `anonymous` | None | IP rate limit, timing-safe bcrypt check |
| `POST` | `/api/auth/mfa/challenge` | `anonymous` | Pre-auth token verification | TOTP validation or backup code check |
| `POST` | `/api/auth/refresh` | `anonymous` | Token Family verification | `HttpOnly` cookie validation, rotation & reuse check |
| `POST` | `/api/auth/logout` | `user` | Revoke current token family | Cookie clearance & DB token revocation |
| **Venues** | | | | |
| `GET` | `/api/venues` | `anonymous` | None | Positional SQL filter bindings |
| `GET` | `/api/venues/:id` | `anonymous` | None | Positional SQL lookup |
| `POST` | `/api/venues` | `venue_manager` | Sets `created_by = req.user.sub` | `requireRole('venue_manager', 'admin')` |
| `PUT` | `/api/venues/:id` | `venue_manager` | Must be venue creator OR admin | `requireRole('venue_manager', 'admin')` + DB ownership check |
| `DELETE` | `/api/venues/:id` | `admin` | Admin privilege only | `requireRole('admin')` |
| **Events** | | | | |
| `GET` | `/api/events` | `anonymous` | None | Positional SQL filter bindings |
| `GET` | `/api/events/:id` | `anonymous` | None | Positional SQL lookup |
| `POST` | `/api/events` | `user` | Sets `organizer_id = req.user.sub` | `authenticateToken` + XSS sanitization |
| `POST` | `/api/events/:id/join` | `user` | Prevents duplicate registration | `authenticateToken` + capacity validation |
| `POST` | `/api/events/:id/leave`| `user` | Must be registered participant | `authenticateToken` + attendee lookup |
| **Bookings & IDOR Defense** | | | | |
| `GET` | `/api/bookings/my` | `user` | Enforces `WHERE user_id = req.user.sub`| `authenticateToken` scoped query |
| `GET` | `/api/bookings/:id` | `user` | **Must be booking owner OR admin** | `authenticateToken` + Server-side ownership check (IDOR Defense) |
| `POST` | `/api/bookings` | `user` | Sets `user_id = req.user.sub` | `authenticateToken` + Court availability check |
| `POST` | `/api/bookings/:id/cancel`| `user` | **Must be booking owner OR admin** | `authenticateToken` + Server-side ownership check |
| **Profiles & Player Directory** | | | | |
| `GET` | `/api/players` | `user` | Public athlete cards (PII redacted) | `authenticateToken` |
| `GET` | `/api/players/:id` | `user` | Public view (No phone/email/MFA secret)| `authenticateToken` |
| `GET` | `/api/players/profile/me` | `user` | Returns full personal profile | `authenticateToken` scoped to `req.user.sub` |
| `PUT` | `/api/players/profile/me` | `user` | Modifies only own profile | `authenticateToken` scoped to `req.user.sub` |
| `POST` | `/api/players/mfa/setup` | `user` | Self-enrollment for TOTP MFA | `authenticateToken` + base32 secret generation |
| `POST` | `/api/players/mfa/confirm`| `user` | Confirms code before enabling MFA | `authenticateToken` + TOTP code validation |
| **Administrative Governance** | | | | |
| `GET` | `/api/admin/users` | `admin` | None (Platform-wide user directory) | `requireRole('admin')` |
| `PUT` | `/api/admin/users/:id/role`| `admin` | Modifies user roles | `requireRole('admin')` + Prevents self-demotion |
| `GET` | `/api/admin/audit-logs` | `admin` | None (Platform audit log inspection) | `requireRole('admin')` |
| `GET` | `/api/admin/audit-logs/verify`| `admin` | Evaluates SHA-256 chain integrity | `requireRole('admin')` |
| `GET` | `/api/admin/alerts` | `admin` | None (Platform security alerts) | `requireRole('admin')` |
| `POST` | `/api/admin/alerts/:id/resolve`| `admin` | Resolves security alert | `requireRole('admin')` |
| `GET` | `/api/admin/export` | `admin` | Rate-limited data export | `requireRole('admin')` + `exportLimiter` (5/hr) |

---

## 3. IDOR Defense Implementation Specification

When an endpoint takes a resource identifier in the URL path (`/api/bookings/:id`), object-level authorization is enforced by retrieving the resource and comparing the stored `user_id` against `req.user.sub`:

```typescript
if (req.user.role !== 'admin' && resource.user_id !== req.user.sub) {
  await logAuditEvent({
    event_type: 'IDOR_ACCESS_ATTEMPT_BLOCKED',
    severity: 'WARNING',
    actor_id: req.user.sub,
    actor_role: req.user.role,
    resource: req.originalUrl,
    action: req.method,
    outcome: 'BLOCKED',
  });
  return res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource' });
}
```

This prevents vertical escalation (players accessing admin records) and horizontal escalation (players accessing other players' records).

# Evidence 07: Insecure Direct Object References (IDOR) Defense

## Classification
- **CWE:** CWE-639: Authorization Bypass Through User-Controlled Key
- **OWASP Top 10:** A01:2021 – Broken Access Control

## Attack Scenario (Before Hardening)
In booking and e-commerce applications, entities such as bookings, tickets, and user invoices are indexed by integer IDs or UUIDs. In vulnerable implementations, endpoints such as `GET /api/bookings/:id` or `POST /api/bookings/:id/cancel` retrieve or alter the database row using `WHERE id = $id` without confirming whether the requesting user actually owns the record. 

An authenticated player (User A) can systematically iterate or guess booking identifiers belonging to other players (User B), snooping on their schedule, venue locations, and payment amounts, or maliciously canceling their reservations.

## Defensive Implementation
1. **Server-Side Object Ownership Enforcement:**
   Every entity lookup verifies authorization at the data boundary before returning or modifying state:
```typescript
const booking = await db.queryOne<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
if (!booking) {
  return res.status(404).json({ error: 'Booking not found' });
}

// Ownership check: Must be owner OR an administrator
if (req.user!.role !== 'admin' && booking.user_id !== req.user!.sub) {
  await logAuditEvent({
    event_type: 'IDOR_ACCESS_ATTEMPT_BLOCKED',
    severity: 'WARNING',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    resource: req.originalUrl,
    action: req.method,
    outcome: 'BLOCKED',
    details: {
      bookingId: id,
      resourceOwnerId: booking.user_id,
      attemptedByUserId: req.user!.sub,
    },
  });

  return res.status(403).json({ error: 'Forbidden: You do not have permission to access this booking' });
}
```
2. **Context-Aware Tamper Logging:**
   Whenever a cross-tenant access violation occurs, the system records an explicit `IDOR_ACCESS_ATTEMPT_BLOCKED` audit log event with both `resourceOwnerId` and `attemptedByUserId`, alerting security analysts of horizontal privilege escalation attempts.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 7`):
1. Creates a sample booking belonging to User B (`userIdB`).
2. Issues `GET /api/bookings/:bookingIdB` authenticated as User A (`userTokenA`).
3. Verifies response returns `403 Forbidden` with `"Forbidden: You do not have permission to access this booking"`.
4. Issues `POST /api/bookings/:bookingIdB/cancel` authenticated as User A.
5. Verifies cancellation attempt returns `403 Forbidden`.
6. Issues `GET /api/bookings/:bookingIdB` authenticated as User B; verifies it succeeds (`200 OK`).
7. Issues `GET /api/bookings/:bookingIdB` authenticated as Admin; verifies it succeeds (`200 OK`).

### Test Result
```
✓ TEST 7: User A attempting to view or cancel User B booking must receive 403 Forbidden (12ms)
```

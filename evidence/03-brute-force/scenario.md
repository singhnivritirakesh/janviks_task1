# Evidence 03: Brute Force & Credential Stuffing Defense

## Classification
- **CWE:** CWE-307: Improper Restriction of Excessive Authentication Attempts
- **OWASP Top 10:** A07:2021 – Identification and Authentication Failures

## Attack Scenario (Before Hardening)
In standard unhardened applications, authentication endpoints respond with generic error messages but do not track consecutive failed attempts per account or IP address. An adversary armed with credential stuffing lists or automated password cracking tools (Hydra, Burp Intruder) can launch thousands of password guesses per minute without penalty until a valid credential matches.

Furthermore, applications that return faster when a user does not exist (skipping password hashing) allow adversaries to enumerate valid user accounts via timing side-channels.

## Defensive Implementation
1. **Account Lockout Policy:**
   - Tracks `failed_login_attempts` counter and `locked_until` timestamp in the `users` table.
   - After 5 consecutive failures, the account is immediately locked for 15 minutes (`locked_until = now() + 15 min`).
   - Any login attempts against a locked account return `423 Locked` immediately.
2. **Timing Attack Mitigation:**
   - When a queried user is not found, the server performs a dummy bcrypt hash comparison against a precomputed reference hash (`dummyHash`). This ensures execution time for nonexistent emails is indistinguishable from incorrect passwords for existing accounts (~80-100ms on cost factor 12).
3. **IP Rate Limiting:**
   - `authLimiter` limits IP addresses to 10 authentication requests per 15-minute window in production, returning `429 Too Many Requests`.
4. **Security Alert Generation:**
   - Reaching 5 failed attempts automatically creates a `HIGH` severity alert `BRUTE_FORCE_ACCOUNT_TARGETED` in `security_alerts`.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 3`):
1. Creates a target user (`lockout-test@playsphere.local`).
2. Submits 5 consecutive incorrect password attempts. All 5 return `401 Unauthorized` and increment `failed_login_attempts`.
3. Submits a 6th attempt.
4. Server detects `failed_login_attempts >= 5` and returns `423 Locked` with message `"Account is temporarily locked due to multiple failed login attempts. Please try again after 15 minutes."`.
5. Verifies database query for `BRUTE_FORCE_ACCOUNT_TARGETED` security alert.

### Test Result
```
✓ TEST 3: Repeated failed login attempts must lock the account and generate security alerts (1984ms)
```

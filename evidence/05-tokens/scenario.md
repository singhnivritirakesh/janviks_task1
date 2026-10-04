# Evidence 05: Cryptographic Token Security, Algorithm Enforcement & Rotation

## Classification
- **CWE:** CWE-287: Improper Authentication, CWE-347: Improper Verification of Cryptographic Signature
- **OWASP Top 10:** A07:2021 – Identification and Authentication Failures, A02:2021 – Cryptographic Failures

## Attack Scenario (Before Hardening)
1. **Algorithm Confusion Attack (CVE-2015-9235):** If a backend verifies JWTs with standard `jwt.verify(token, key)` without explicitly restricting algorithms, an attacker can re-sign a token using the server's public RSA key as an HMAC-SHA256 secret. The server verifies it with its public key, erroneously accepting the attacker's forged claims.
2. **Algorithm 'none' Attack:** An attacker sets `"alg": "none"` in the JWT header and strips the signature. Flawed libraries accept the unsigned payload as trusted.
3. **Session Hijacking via Stolen Refresh Tokens:** If refresh tokens are long-lived and static, an adversary who steals a refresh token can maintain persistent access indefinitely.

## Defensive Implementation
1. **Asymmetric RS256 with Strict Enforcement:**
   Tokens are signed with RSA-2048 private keys. Verification explicitly enforces:
```typescript
jwt.verify(token, publicKey, {
  algorithms: ['RS256'], // Explicitly whitelist RS256 only; rejects 'none', 'HS256', etc.
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
});
```
2. **Short-Lived Access Tokens:**
   Access token TTL is capped at 15 minutes (`JWT_ACCESS_TOKEN_TTL_MINUTES=15`).
3. **Opaque Rotating Refresh Tokens with Family Invalidation:**
   - Refresh tokens are 256-bit cryptographically secure random values (hashed with SHA-256 before storage in SQLite/Postgres).
   - Each refresh token belongs to a `family_id`.
   - Upon valid refresh, the old token is marked `revoked_at = now()`, and a new token in the same family is issued.
   - **Reuse Detection:** If an adversary attempts to reuse an old, revoked refresh token, the server detects reuse, invalidates the **entire token family**, terminates the session, logs an audit event, and fires a `CRITICAL` alert `REFRESH_TOKEN_REUSE_DETECTED`.
4. **Hardened Cookie Attributes:**
   Refresh tokens are delivered strictly via `HttpOnly; Secure; SameSite=Strict; Path=/api/auth` cookies. JavaScript cannot access them via `document.cookie`.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 5`):
1. Signs an unsigned token with `alg: 'none'` -> `401 Unauthorized` (Blocked).
2. Signs a token with `alg: 'HS256'` using the server's public key -> `401 Unauthorized` (Blocked).
3. Signs an expired RS256 token -> `401 Unauthorized` (Blocked).
4. Performs a legitimate refresh exchange. Then presents the **old** refresh token again.
5. Verifies old token returns `401 Unauthorized` with `'Refresh token reuse detected'`.
6. Attempts to use the **new** token from step 4; verifies it is ALSO blocked because the whole family was revoked.

### Test Result
```
✓ TEST 5: Tokens with alg=none, HS256 confusion, expired tokens, and reused refresh tokens must be rejected (348ms)
```

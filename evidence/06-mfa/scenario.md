# Evidence 06: Multi-Factor Authentication (MFA) & Step-Up Verification

## Classification
- **CWE:** CWE-308: Use of Single-factor Authentication
- **OWASP Top 10:** A07:2021 – Identification and Authentication Failures

## Attack Scenario (Before Hardening)
In the original implementation, all users (including privileged administrators) authenticated using single-factor password authentication. If an administrator's credentials were exposed via credential stuffing, phishing, or password reuse from an external breach, the attacker gained instant administrative privileges, allowing access to user data, financial records, and system configurations with no secondary verification.

## Defensive Implementation
1. **Mandatory MFA Policy for Administrators:**
   All administrative accounts require active RFC 6238 Time-based One-Time Passwords (TOTP) to complete session establishment.
2. **Two-Stage Authentication Flow:**
   - **Stage 1 (Primary Credentials):** Submitting valid email and password returns `requireMfa: true` and a cryptographically signed, short-lived (5 min) `preAuthToken`. **No session access token or refresh cookie is granted.**
   - **Stage 2 (MFA Challenge):** The client submits `{ preAuthToken, code }` to `/api/auth/mfa/challenge`. The server validates the TOTP code against the user's base32 `mfa_secret` with a window of ±1 step (30 seconds) to accommodate clock drift.
3. **Emergency Backup Codes:**
   - MFA enrollment generates 8 cryptographically random alphanumeric backup codes.
   - Backup codes are hashed using SHA-256 before storage in the database.
   - Upon presentation of a backup code, the server verifies the hash, permits login, and immediately consumes and deletes the used code from the database, preventing replay.
4. **MFA Rate Limiting:**
   The MFA challenge endpoint is protected by `authLimiter` to prevent brute forcing the 6-digit code space (1,000,000 combinations).

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 6`):
1. Submits admin credentials to `/api/auth/login`. Receives `requireMfa: true` and `preAuthToken`. Confirms `accessToken` is `undefined`.
2. Submits an invalid TOTP code (`000000`). Receives `401 Unauthorized` with `'Invalid MFA verification code'`.
3. Submits an authentic TOTP code generated using `otplib.authenticator.generate(adminMfaSecret)`.
4. Receives `200 OK`, valid RS256 `accessToken`, HttpOnly refresh cookie, and user object with `role: 'admin'`.

### Test Result
```
✓ TEST 6: Administrator login must require TOTP challenge step; valid code grants session tokens (356ms)
```

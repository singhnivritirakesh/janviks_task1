# STRIDE Threat Model — PlaySphere Connect

This document outlines the systematic threat modeling analysis of PlaySphere Connect using the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).

---

## 1. System Scope & Trust Boundaries

The system defines four trust boundaries:
1. **TB-1: Client / Public Network Boundary:** Untrusted web browsers communicating over public internet with the Nginx reverse proxy.
2. **TB-2: DMZ / Application Server Boundary:** Reverse proxy communicating with the internal Node.js Express API.
3. **TB-3: Application / Database Boundary:** Node.js Express API communicating with the isolated PostgreSQL database.
4. **TB-4: Identity / Cryptographic Boundary:** Private key storage, JWT signing engine, and TOTP secret generation.

---

## 2. STRIDE Threat Analysis Matrix

| Threat ID | Component | STRIDE Category | Threat Description | Inherent Risk | Implemented Mitigations | Residual Risk |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: |
| **T-01** | Authentication API | **Spoofing** | Adversary submits forged or tampered JWTs (`alg=none` or public-key HMAC confusion) to impersonate administrators. | **CRITICAL** | Strict RS256 asymmetric verification; rejection of `none`/HS256; verification of `iss`, `aud`, and expiration; JWKS public key verification. | **LOW** |
| **T-02** | Authentication API | **Spoofing** | Credential stuffing and brute-force attacks against user or administrator passwords. | **HIGH** | Account lockout after 5 consecutive failures for 15 minutes; IP rate limiting (`authLimiter`); mandatory TOTP MFA for admins; NIST password policy. | **LOW** |
| **T-03** | Database / Storage | **Tampering** | Malicious SQL fragments injected into search and filter parameters to corrupt or delete data. | **CRITICAL** | 100% parameterized queries with positional bind parameters (`$1, $2, ...`); Zod input validation schemas; no string concatenation. | **LOW** |
| **T-04** | Audit Logging | **Repudiation** | Attacker alters or deletes audit log entries in the database to conceal malicious activity. | **HIGH** | SHA-256 cryptographic hash chaining (`prev_hash` + `hash`); immutable audit schema; administrative chain verification endpoint (`/api/admin/audit-logs/verify`). | **LOW** |
| **T-05** | API Responses & Frontend | **Information Disclosure**| Error stack traces, framework versions, or sensitive user PII (MFA secrets, password hashes) leaked in responses. | **MEDIUM** | Centralized error handler returning generic errors with correlation `requestId`; removal of `X-Powered-By`; PII sanitization in public player endpoints. | **LOW** |
| **T-06** | Ingress / Reverse Proxy | **Denial of Service** | Volumetric HTTP request floods targeting authentication or API endpoints to degrade availability. | **HIGH** | Multi-tier rate limiting (Nginx limit zones + Express `rateLimit`); body size limits (1MB); connection keep-alive tuning. | **LOW** |
| **T-07** | Bookings / Resources | **Elevation of Privilege**| Authenticated player manipulates booking IDs in API requests to inspect or cancel bookings of other tenants (IDOR). | **HIGH** | Server-side object ownership verification (`booking.user_id === req.user.sub` or `role === 'admin'`); audit logging on access denial. | **LOW** |
| **T-08** | Admin API | **Elevation of Privilege**| Player calls administrative endpoints directly or manipulates role assignment payloads. | **CRITICAL** | Server-side `requireRole('admin')` middleware; validation preventing self-demotion or unauthorized role changes. | **LOW** |
| **T-09** | Event & Venue Creation | **Tampering / Spoofing** | Stored XSS payloads embedded in event titles or venue descriptions to execute scripts in victims' browsers. | **HIGH** | Server-side HTML sanitization (`sanitize-html`) stripping all executable script/iframe/event tags; Strict Content-Security-Policy headers. | **LOW** |
| **T-10** | Session Management | **Information Disclosure**| Refresh tokens intercepted via XSS attacks or replayed across sessions. | **HIGH** | `HttpOnly; Secure; SameSite=Strict` cookies; opaque 256-bit cryptographically random tokens; automated token family invalidation upon reuse detection. | **LOW** |

---

## 3. Threat Reduction Summary

By deploying defensive controls across all tiers:
- **Inherent Critical/High Risks:** 8
- **Residual Critical/High Risks:** 0
- **Overall Posture:** Hardened against OWASP Top 10 (2021) and Common Weakness Enumerations (CWE).

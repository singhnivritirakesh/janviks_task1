# 🛡️ PlaySphere Connect — Hardened Full-Stack Sports Platform

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-Passing-brightgreen)](#devsecops--cicd)
[![Security Tests](https://img.shields.io/badge/Security%20Tests-8%20of%208%20Passed-brightgreen)](#automated-security-test-suite)
[![ESLint](https://img.shields.io/badge/ESLint-0%20Errors%20%7C%200%20Warnings-brightgreen)](#code-quality--linting)
[![Compliance](https://img.shields.io/badge/Compliance-OWASP%20ASVS%204.0%20%7C%20NIST%20800--63B-blue)](#standards--compliance)

**PlaySphere Connect** is an enterprise-hardened sports and fitness discovery application engineered to demonstrate the implementation of secure software engineering principles, cryptographic access control, multi-factor authentication, and defense-in-depth architecture.

---

## 🌟 Architecture Overview

PlaySphere Connect implements a 3-tier isolated architecture:

```
[ Internet / Browser ]
          │  HTTPS / Port 443
          ▼
┌──────────────────────────────────────────────┐
│  Nginx Hardened Reverse Proxy (DMZ)          │
│  - TLS 1.2/1.3 Termination (Strict Ciphers)  │
│  - Rate Limiting Zones (DDoS mitigation)     │
│  - Strict CSP, HSTS, X-Frame-Options: DENY   │
└──────────────────────┬───────────────────────┘
                       │  HTTP / Internal Port 5000 (frontend-net)
                       ▼
┌──────────────────────────────────────────────┐
│  PlaySphere API Backend (Node.js / Express)  │
│  - RS256 Asymmetric JWT Auth (15 min TTL)    │
│  - RFC 6238 TOTP Multi-Factor Authentication │
│  - Server-side RBAC & IDOR Ownership Defense │
│  - SHA-256 Tamper-Evident Audit Hash Chain   │
│  - Real-time Detection Alerts Engine         │
└──────────────────────┬───────────────────────┘
                       │  PostgreSQL / Internal Port 5432 (backend-net)
                       ▼
┌──────────────────────────────────────────────┐
│  Database Tier (PostgreSQL 16 / SQLite)      │
│  - Parameterized Queries ($1, $2, ...)       │
│  - Zero Host Port Exposure                   │
│  - Rootless Execution                        │
└──────────────────────────────────────────────┘
```

---

## 🔒 10 Core Security Controls Implemented

| ID | Control | CWE / OWASP | Defensive Implementation | Verification |
| :---: | :--- | :--- | :--- | :--- |
| **01** | **SQL Injection Defense** | CWE-89 / A03:2021 | 100% Parameterized queries with positional bindings (`$1, $2, ...`); Zod input schemas. | `TEST 1` Passed |
| **02** | **Role-Based Access Control** | CWE-285 / A01:2021 | Server-side `requireRole()` middleware (`admin`, `venue_manager`, `user`). | `TEST 2` Passed |
| **03** | **Brute-Force & Lockout** | CWE-307 / A07:2021 | Account lockout after 5 failed attempts for 15 min; IP rate limiting; timing attack defense. | `TEST 3` Passed |
| **04** | **Cross-Site Scripting (XSS)** | CWE-79 / A03:2021 | Server-side `sanitize-html` stripping all executable script tags; strict CSP. | `TEST 4` Passed |
| **05** | **Cryptographic Token Auth** | CWE-347 / A02:2021 | Asymmetric RS256 JWTs; rejection of `none`/HS256; opaque rotating refresh tokens in `HttpOnly` cookies; token family reuse detection. | `TEST 5` Passed |
| **06** | **Multi-Factor Auth (MFA)** | CWE-308 / A07:2021 | Mandatory RFC 6238 TOTP for admins; two-stage pre-auth handshake; single-use hashed backup codes. | `TEST 6` Passed |
| **07** | **IDOR Prevention** | CWE-639 / A01:2021 | Server-side entity ownership checks (`booking.user_id === req.user.sub` or `role === 'admin'`). | `TEST 7` Passed |
| **08** | **Secret Sanitization** | CWE-798 / A05:2021 | Zero hardcoded credentials in repo; `.env.example` contract; Gitleaks automated scanning. | DevSecOps CI |
| **09** | **Network Segmentation** | CWE-668 / A05:2021 | Multi-tier Docker Compose; database isolated on unexposed `backend-net`; non-root containers. | Network Audit |
| **10** | **Defensive HTTP Headers** | CWE-693 / A05:2021 | Strict CSP, HSTS (`max-age=31536000`), X-Frame-Options `DENY`, nosniff, `X-Powered-By` hidden. | `TEST 8` Passed |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js:** v20.x or v22.x LTS
- **NPM:** v10.x or higher
- **Git**
- *(Optional for containerized run)*: Docker Engine & Docker Compose

### 2. Installation & Setup
```bash
# Clone repository
git clone https://github.com/your-org/playsphere-connect.git
cd playsphere-connect

# Install dependencies (root and backend)
npm install

# Generate RSA-2048 Asymmetric Cryptographic Keypair
npm run gen-keys

# Initialize database schema and demo seed data
npm run server:seed
```

### 3. Running in Development Mode
To launch the full-stack development environment concurrently:
```bash
# Start backend API (Port 5000) and frontend Vite dev server (Port 5173)
npm run dev:all
```
- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Hardened API:** [http://localhost:5000](http://localhost:5000)
- **JWKS Endpoint:** [http://localhost:5000/.well-known/jwks.json](http://localhost:5000/.well-known/jwks.json)
- **Health Probe:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🧪 Testing & Verification

### Automated Security Controls Test Suite (Vitest)
Executes 8 comprehensive penetration and security control tests verifying all mitigations against live API endpoints:
```bash
npm run test:security
```
```
 ✓ server/tests/security/security.test.ts (8 tests)
   ✓ TEST 1: SQL Injection attempts in search, filter, and login must be completely blocked
   ✓ TEST 2: Low-privileged user calling admin endpoint must receive 403 Forbidden and trigger security alert
   ✓ TEST 3: Repeated failed login attempts must lock the account and generate security alerts
   ✓ TEST 4: Stored XSS payloads must be neutralized and stripped of all executable tags
   ✓ TEST 5: Tokens with alg=none, HS256 confusion, expired tokens, and reused refresh tokens must be rejected
   ✓ TEST 6: Administrator login must require TOTP challenge step; valid code grants session tokens
   ✓ TEST 7: User A attempting to view or cancel User B booking must receive 403 Forbidden
   ✓ TEST 8: Security headers (CSP, HSTS, X-Frame-Options, nosniff) must be enforced and X-Powered-By hidden
```

### Code Quality & Linting
```bash
# Zero errors and zero warnings policy enforced across all source files
npm run lint

# Verify TypeScript types without emitting files
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p server/tsconfig.json
```

### Production Build
```bash
# Build optimized client assets in dist/
npm run build
```

---

## 🐳 Multi-Tier Docker Deployment

To launch the multi-tier containerized stack in production:
```bash
# 1. Generate TLS certificates for reverse proxy
bash docker/certs/gen-certs.sh

# 2. Build and launch container stack
docker compose up -d --build
```
Access the application securely via **`https://localhost`** (Nginx terminates TLS and proxies to the internal API).

---

## 👥 Demonstration Accounts & Roles

All demo accounts are pre-seeded with secure passwords:

| Role | Email | Password | MFA Configuration |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@playsphere.local` | `AdminSecurePass2026!` | **Mandatory TOTP** (Use CLI enrollment below) |
| **Venue Manager** | `manager@playsphere.local` | `ManagerSecurePass2026!` | Optional |
| **Player / Athlete** | `player@playsphere.local` | `PlayerSecurePass2026!` | Optional |

### Interactive Admin Creation & MFA Enrollment CLI
To create a new administrator with a live interactive QR code and secret:
```bash
npm run create-admin
```
Follow the terminal prompt to scan the QR code using Google Authenticator, Authy, or 1Password.

---

## 🛡️ DevSecOps CI/CD Pipeline

The repository integrates continuous security scanning via GitHub Actions:
- **`.github/workflows/ci.yml`**: Runs linting, typechecking, production build, and automated Vitest security tests on every push.
- **`.github/workflows/security.yml`**:
  - **SAST:** Semgrep auditing against OWASP Top 10 and TypeScript rules.
  - **SCA:** `npm audit` scanning third-party dependencies.
  - **Secret Detection:** Gitleaks enforcing rules in `.gitleaks.toml`.
  - **Container Scanning:** Trivy scanning Dockerfiles and container images for CVEs.
  - **DAST:** OWASP ZAP baseline scan against the active API.

---

## 📚 Documentation Index

- [Security Assessment Report (`docs/SECURITY_REPORT.md`)](file:///docs/SECURITY_REPORT.md): Complete 10-section formal assessment and compliance report.
- [System Architecture Specification (`docs/architecture.md`)](file:///docs/architecture.md): Diagrams, network matrix, and cryptographic lifecycle.
- [RBAC Authorization Matrix (`docs/rbac-matrix.md`)](file:///docs/rbac-matrix.md): Granular permission mapping for all endpoints.
- [STRIDE Threat Model (`docs/threat-model.md`)](file:///docs/threat-model.md): Detailed component threat analysis.
- [Initial Vulnerability Audit (`docs/00-audit.md`)](file:///docs/00-audit.md): Pre-remediation findings and baseline data models.
- [Security Evidence Folder (`evidence/`)](file:///evidence/): Scenarios, logs, and raw proofs for all 10 controls.

---

## ⚖️ Standards & Compliance

- **OWASP ASVS 4.0:** Verified across Sections V2, V3, V4, V5, V8, V13, and V14.
- **NIST SP 800-63B:** Compliant with Authenticator Assurance Level 2 (AAL2).
- **SOC 2 Type II:** Compliant with Common Criteria CC6.1, CC6.6, CC6.7, CC7.2.

# PlaySphere Connect: Security & Architecture Audit Report

**Date:** 2026-10-04  
**Auditor:** Senior Application Security Engineer & Full-Stack Architect  
**Target:** PlaySphere Connect (Sports & Fitness Discovery Web Application)  
**Status:** Baseline Security & Architecture Audit (Pre-Remediation)

---

## 1. Executive Summary

This initial audit examines the existing codebase, architecture, configuration, and data access models of the PlaySphere Connect application. The application was initially constructed as a client-heavy Single Page Application (SPA) leveraging Vite, React 18, TypeScript, TailwindCSS, and shadcn/ui. 

The original backend architecture relied on direct client-side integration with Supabase (`@supabase/supabase-js`), where the browser held public API keys and communicated directly with cloud database tables and authentication services. This architectural model presents critical security deficiencies that fail compliance requirements for enterprise security, specifically regarding server-enforced Role-Based Access Control (RBAC), multi-factor authentication (MFA), short-lived asymmetric tokens (RS256), refresh token rotation with reuse detection, account lockout, brute-force mitigation, tamper-evident audit logging, real-time security alerting, and defense-in-depth network segregation.

---

## 2. Secrets & Compromised Credentials Audit

During inspection of configuration and environment files, active third-party credentials were found committed directly in the repository:

### 2.1 Findings in `.env` (Formerly uploaded as `_env`)
* **`VITE_SUPABASE_PROJECT_ID`**: `"pixssmgcwikcxbanlzte"`
* **`VITE_SUPABASE_URL`**: `"https://pixssmgcwikcxbanlzte.supabase.co"`
* **`VITE_SUPABASE_PUBLISHABLE_KEY`**: 
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpeHNzbWdjd2lrY3hiYW5senRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjc3NjIsImV4cCI6MjA4OTY0Mzc2Mn0.uTQjFfQihWB8x2SMd718vcrtY2alD6BakAg130ZWgRo`

### 2.2 Security Assessment & Immediate Remediation Plan
* **Status**: **COMPROMISED**. The publishable key and project endpoint were exposed in plaintext in the codebase.
* **Immediate Actions**:
  1. Revoke and rotate the exposed Supabase API credentials immediately in the cloud provider console.
  2. Deprecate and completely eliminate client-side Supabase connectivity from the application architecture.
  3. Remove the `.env` file containing secrets from version control and git history.
  4. Create a clean `.env.example` with zero hardcoded credentials and placeholder tokens only.
  5. Update `.gitignore` to strictly exclude all `.env*` files (`.env`, `.env.local`, `.env.production`, etc.).

---

## 3. Data Model & Architecture Mapping

The legacy application supported four primary business entities: Venues, Events, Bookings, and Players/Profiles.

### 3.1 Legacy Data Models
1. **Venues (`venues`)**:
   * Fields: `id` (UUID), `name` (text), `description` (text), `address` (text), `city` (text), `sport_types` (text array), `amenities` (text array), `hourly_rate` (numeric), `image_url` (text), `rating` (numeric), `created_at` (timestamp).
   * Security Weakness: Public write/update endpoints or missing ownership checks allowed unauthorized venue modification.
2. **Events (`events`)**:
   * Fields: `id` (UUID), `title` (text), `description` (text), `venue_id` (UUID foreign key), `date` (date/string), `start_time` (string), `end_time` (string), `max_participants` (int), `current_participants` (int), `price` (numeric), `sport_type` (text), `skill_level` (enum/text), `organizer_id` (UUID), `status` (text).
   * Security Weakness: Lack of server validation allowed participant counts to be manipulated or negative pricing to be injected.
3. **Bookings (`bookings`)**:
   * Fields: `id` (UUID), `user_id` (UUID foreign key), `venue_id` (UUID foreign key), `date` (date), `start_time` (text), `end_time` (text), `total_price` (numeric), `status` (text), `created_at` (timestamp).
   * Security Weakness: Insecure Direct Object References (IDOR). Direct browser queries allowed users to read and modify other users' court reservations.
4. **Players / Profiles (`profiles`)**:
   * Fields: `id` (UUID), `user_id` (UUID), `full_name` (text), `avatar_url` (text), `bio` (text), `favorite_sports` (text array), `skill_levels` (json/text), `location` (text), `games_played` (int), `rating` (numeric).
   * Security Weakness: Lack of profile update validation permitted horizontal privilege escalation and unauthorized modification.

---

## 4. Page-to-API Dependency Analysis

| Frontend Page / Component | Legacy Supabase Call / Action | Required Secure API Endpoint | Required Role / Authorization |
| :--- | :--- | :--- | :--- |
| **`Index.tsx`** | `supabase.from('venues').select()`, `supabase.from('events').select()`, `supabase.from('profiles').select()` | `GET /api/venues?featured=true`<br>`GET /api/events?limit=5`<br>`GET /api/players?limit=4` | Public / Anonymous |
| **`LoginPage.tsx`** | `supabase.auth.signInWithPassword()`<br>`supabase.auth.signUp()` | `POST /api/auth/login`<br>`POST /api/auth/register`<br>`POST /api/auth/mfa/challenge` | Public (Rate-limited, brute-force guarded) |
| **`VenuesPage.tsx`** | `supabase.from('venues').select('*')` with client filters | `GET /api/venues` (query params for search, city, sport) | Public / Authenticated |
| **`VenueDetailPage.tsx`** | `supabase.from('venues').select().eq('id', id)`<br>`supabase.from('bookings').insert()` | `GET /api/venues/:id`<br>`POST /api/bookings` | `GET`: Public<br>`POST`: Authenticated `user` / `venue_manager` / `admin` |
| **`EventsPage.tsx`** | `supabase.from('events').select()`<br>`supabase.from('events').update()` | `GET /api/events`<br>`POST /api/events` (create)<br>`POST /api/events/:id/join` | `GET`: Public<br>`POST`: Authenticated |
| **`PlayersPage.tsx`** | `supabase.from('profiles').select()` | `GET /api/players` | Public / Authenticated |
| **`ProfilePage.tsx`** | `supabase.from('profiles').select().eq('user_id', user.id)`<br>`supabase.from('bookings').select().eq('user_id', user.id)` | `GET /api/users/me`<br>`PUT /api/users/me`<br>`GET /api/bookings/my` | Authenticated (Self only) |
| **`BookingConfirmedPage.tsx`** | Reads booking state or queries booking ID | `GET /api/bookings/:id` | Authenticated (Owner or Admin only - IDOR protected) |
| **Admin Pages (New)** | *Not implemented in legacy code* | `GET /api/admin/users`<br>`PUT /api/admin/users/:id/role`<br>`PUT /api/admin/users/:id/lock`<br>`GET /api/admin/audit-logs`<br>`GET /api/admin/security-alerts`<br>`POST /api/admin/export` | **Strict Admin Only (`admin` role + verified MFA)** |

---

## 5. Code Quality & Linting Analysis (`lint.txt`)

An analysis of `lint.txt` reveals 18 errors and 8 warnings that were bypassed in `eslint.config.js` by disabling TypeScript rules:

1. **Explicit Any Errors (`@typescript-eslint/no-explicit-any`)**:
   * `src/hooks/use-data.ts`: Lines 25, 26 (untyped query parameters and response types).
   * `src/pages/BookingConfirmedPage.tsx`: Line 9 (untyped booking details).
   * `src/pages/EventsPage.tsx`: Line 65 (untyped event list items).
   * `src/pages/Index.tsx`: Lines 23, 28, 33, 106, 151, 184 (untyped venue, event, and player objects).
   * `src/pages/LoginPage.tsx`: Line 41 (untyped login form events).
   * `src/pages/PlayersPage.tsx`: Line 67 (untyped player record mapping).
   * `src/pages/ProfilePage.tsx`: Line 105 (untyped profile form attributes).
   * `src/pages/VenueDetailPage.tsx`: Lines 42, 116 (untyped court and booking payload).
   * `src/pages/VenuesPage.tsx`: Line 57 (untyped venue filter states).
2. **Empty Interface Errors (`@typescript-eslint/no-empty-object-type`)**:
   * `src/components/ui/command.tsx`: Line 24 (empty interface `CommandDialogProps`).
   * `src/components/ui/textarea.tsx`: Line 5 (empty interface `TextareaProps`).
3. **React Hook Warnings (`react-hooks/exhaustive-deps`)**:
   * `src/hooks/use-auth.ts`: Line 33 (missing `fetchProfile`, `setLoading`, `setUser` dependencies).
4. **Fast Refresh Warnings (`react-refresh/only-export-components`)**:
   * `src/components/ui/badge.tsx`: Line 29 (exporting helper functions alongside component).
   * `src/components/ui/button.tsx`: Line 47 (exporting `buttonVariants` alongside component).
   * `src/components/ui/form.tsx`: Line 129.
   * `src/components/ui/navigation-menu.tsx`: Line 111.
   * `src/components/ui/sidebar.tsx`: Line 636.
   * `src/components/ui/sonner.tsx`: Line 27.
   * `src/components/ui/toggle.tsx`: Line 37.

**Remediation Plan**: Re-enable `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, and `@typescript-eslint/no-empty-object-type` in `eslint.config.js`. Define strict TypeScript interfaces for all domain entities, API request/response structures, and UI props.

---

## 6. Vulnerabilities Identified (Baseline for Final Security Report)

The following vulnerabilities have been cataloged from the initial audit and will be formally remediated, re-tested, and documented with before/after evidence:

| ID | Vulnerability Title | Severity | Root Cause | Remediated Design |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Exposed Cloud Credentials | **Critical** | Hardcoded Supabase keys in committed `.env` file | Completely remove cloud keys; use server-side environment variables; add `.env` to `.gitignore`; introduce secret scanning in CI |
| **VULN-02** | Direct Client-to-Database Architecture | **Critical** | Browser connects directly to database, bypassing server controls | Create dedicated Node.js/Express backend (`/server`) with centralized access control and parameterized queries |
| **VULN-03** | Lack of Server-Enforced RBAC & IDOR | **High** | Client-side authorization logic only; no server-side ownership or role validation | Implement server-side middleware `requireAuth`, `requireRole`, and object-level permission checks (e.g. user cannot access other bookings) |
| **VULN-04** | Missing Multi-Factor Authentication (MFA) | **High** | Single-factor email/password allowed for privileged administrator accounts | Mandate RFC 6238 TOTP MFA for all admin accounts with QR enrollment, backup codes, and pre-auth session tokens |
| **VULN-05** | Credential Stuffing & Brute-Force Susceptibility | **High** | No account lockout or IP rate-limiting on authentication routes | Implement IP rate limiting (`express-rate-limit`) and account lockout (5 failures -> 15 min lock) with constant-time response |
| **VULN-06** | Insecure Token Architecture & Lifetime | **High** | Long-lived tokens stored in browser `localStorage` vulnerable to XSS | Issue short-lived RS256 JWTs (15 min TTL) stored in memory; issue cryptographically random refresh tokens in HttpOnly; Secure; SameSite=Strict cookies with rotation & family reuse detection |
| **VULN-07** | Absence of Tamper-Evident Audit Logging | **Medium** | No centralized logging of authentication, authorization failures, or administrative changes | Build an append-only `audit_logs` service featuring SHA-256 cryptographic hash-chaining (`prev_hash` + `hash`) |
| **VULN-08** | Lack of Security Monitoring & Attack Alerts | **Medium** | No detection mechanism for active attacks | Implement an automated alerts engine detecting failed login bursts, 401/403 floods, refresh token reuse, and data harvesting |
| **VULN-09** | Missing Defensive HTTP Security Headers | **Medium** | No Content Security Policy (CSP), HSTS, X-Frame-Options, or nosniff headers | Configure Helmet on backend and Nginx reverse proxy with strict CSP, HSTS, frame-ancestors 'none', and MIME-type enforcement |
| **VULN-10** | Third-Party Metadata & Asset Leakage | **Low** | `index.html` references Lovable CDNs and external metadata | Cleanse HTML metadata to PlaySphere Connect branding; self-host or strictly allow-list fonts and resources |

---

## 7. Audit Sign-off

The findings in this audit define the requirements for the refactoring phases. Implementation will proceed according to the comprehensive security plan.

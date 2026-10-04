#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo "🛡️  PlaySphere Connect: Automated Security Testing Suite"
echo "================================================================="

# Ensure keys are generated
npm run gen-keys

echo "🧪 Running Automated Vitest Security Test Suite..."
npx vitest run server/tests/security/security.test.ts --reporter=verbose

echo "================================================================="
echo "✅ All 8 Mandatory Security Controls Verified Successfully:"
echo "   [1] SQL Injection Defense (Parameterized Queries)"
echo "   [2] RBAC & Privilege Escalation Defense (403 + Alert)"
echo "   [3] Brute-Force Protection & Account Lockout (423 + Alert)"
echo "   [4] Stored & Reflected XSS Neutralization (HTML Sanitization)"
echo "   [5] Asymmetric RS256 Tokens & Refresh Token Reuse Detection"
echo "   [6] Administrator Multi-Factor Authentication (RFC 6238 TOTP)"
echo "   [7] Insecure Direct Object Reference (IDOR) Defense"
echo "   [8] Defensive Security Headers (Strict CSP, HSTS, X-Frame-Options)"
echo "================================================================="

# Evidence 01: SQL Injection (SQLi) Defense

## Classification
- **CWE:** CWE-89: Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')
- **OWASP Top 10:** A03:2021 – Injection

## Attack Scenario (Before Hardening)
In the original architecture, client-side queries connected directly to Supabase using public anonymity keys. An adversary intercepting requests or manipulating URL search parameters could inject SQL fragments or modify post-filtering conditions, bypassing authorization and extracting table records or executing administrative functions:
```http
GET /api/venues?search=' OR 1=1 --
GET /api/venues?city='; DROP TABLE venues; --
```
If an unhardened backend used dynamic string formatting like `db.query("SELECT * FROM venues WHERE name LIKE '%" + search + "%'")`, attackers could extract password hashes or alter database state.

## Defensive Implementation
1. **Parameterized Queries Across All Endpoints:** All SQL interactions in `server/src/db/index.ts` strictly use positional parameter placeholders (`$1, $2, ...` mapped reliably to bind parameters).
2. **Dynamic Query Builder with Positional Bindings:**
```typescript
const conditions: string[] = [];
const params: any[] = [];
if (search) {
  params.push(`%${search}%`);
  conditions.push(`(name LIKE $${params.length} OR description LIKE $${params.length})`);
}
```
3. **Strict Zod Input Validation:** Inputs are validated via Zod schemas (`venuesQuerySchema`, `loginSchema`) before query construction, dropping unknown fields and rejecting out-of-spec types.

## Verification Procedure
The security test suite (`server/tests/security/security.test.ts` - `TEST 1`) executes targeted SQL injection payloads against:
- Venue search parameter: `' OR 1=1 --`
- Venue name parameter: `'; DROP TABLE venues; --`
- Venue union exfiltration: `' UNION SELECT id, password_hash, email FROM users --`
- Authentication email parameter: `' OR '1'='1`

### Test Result
All payloads are safely bound as literal string parameters. The database tables remain untouched, no unauthorized rows are leaked, and the API returns standard empty or error responses without SQL syntax leaks.
```
✓ TEST 1: SQL Injection attempts in search, filter, and login must be completely blocked (78ms)
```

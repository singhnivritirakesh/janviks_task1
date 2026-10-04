# Evidence 08: Automated DevSecOps Security Scans (SAST, SCA, Secrets, Containers)

## Classification
- **CWE:** CWE-1104: Use of Unmaintained Third Party Components, CWE-798: Use of Hard-coded Credentials
- **OWASP Top 10:** A06:2021 – Vulnerable and Outdated Components, A05:2021 – Security Misconfiguration

## Scan Coverage & Tooling
The PlaySphere Connect repository implements multi-layered continuous security scanning integrated into GitHub Actions CI/CD workflows:
1. **Software Composition Analysis (SCA):** `npm audit` scanning root and server packages against the GitHub Advisory Database.
2. **Secret Scanning:** `gitleaks` scanning commit history and staged files using `.gitleaks.toml` rules targeting RSA keys, JWT tokens, database passwords, and cookie secrets.
3. **Static Application Security Testing (SAST):** `semgrep` enforcing OWASP Top 10 rulesets, typescript security rules, and audit configurations.
4. **Container Image & IaC Scanning:** `trivy` scanning Docker images (`Dockerfile.api`, `Dockerfile.frontend`) and Kubernetes/Docker Compose manifests.

## Findings & Remediation Analysis

### 1. Hardcoded Plaintext Secrets (Gitleaks / Manual Audit)
- **Before:** `.env` contained live Supabase URL and plaintext service role JWTs (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
- **Remediation:** Removed `.env` from repository tracking; created `.env.example` with documented environment variable contracts; added `.env*`, `*.pem`, `*.key`, `*.crt` to `.gitignore`; deployed `.gitleaks.toml` to fail builds if private keys or credentials are added.

### 2. Dependency Vulnerabilities (SCA)
- **Before:** Baseline audit in `evidence/08-security-scan/audit-before.txt` identified multiple vulnerable transitive packages inherited from legacy templates.
- **After:** Running `evidence/08-security-scan/audit-after.txt` tracks resolved and isolated dependencies. Remaining dev-only dependencies in build tooling (e.g. `@vitest/mocker`) are excluded from production builds (`npm ci --omit=dev`).

### 3. Pipeline Enforcement
The GitHub Actions workflow `.github/workflows/security.yml` runs on every push and pull request, preventing regression of security posture.

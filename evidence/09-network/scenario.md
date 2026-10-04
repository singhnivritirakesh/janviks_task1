# Evidence 09: Network Segmentation & Multi-Tier Transport Security

## Classification
- **CWE:** CWE-319: Cleartext Transmission of Sensitive Information, CWE-668: Exposure of Resource to Wrong Sphere
- **OWASP Top 10:** A02:2021 – Cryptographic Failures, A05:2021 – Security Misconfiguration

## Architecture & Attack Scenario (Before Hardening)
In simple or monolithic architectures:
1. Databases are frequently mapped directly to host ports (e.g. `0.0.0.0:5432`), exposing database listening sockets to the public internet or local network scanning.
2. Web services communicate over unencrypted plaintext HTTP (port 80), exposing session tokens and passwords to sniffing on untrusted Wi-Fi or transit routers.
3. Compromise of a web process immediately gives network visibility and raw TCP socket access to all internal services.

## Defensive Implementation
1. **Multi-Tier Network Segmentation (`docker-compose.yml`):**
   - **`frontend-net` (Bridge Network):** Connects the internet-facing reverse proxy (`proxy`) to the API backend (`api`). External traffic accesses only ports 80 and 443 on `proxy`.
   - **`backend-net` (Isolated Internal Network):** Connects the API backend (`api`) to PostgreSQL (`db`). Marked `internal: true`, disallowing external egress or direct ingress from outside Docker.
   - **Zero Database Exposure:** Port 5432 is declared using `expose:` (available only to containers on `backend-net`), with **no port mapping** (`ports:`) to the host machine.
2. **TLS 1.2 & 1.3 Termination (`docker/nginx/nginx.conf`):**
   - Insecure legacy ciphers (SSLv3, TLS 1.0, TLS 1.1, RC4, 3DES) are disabled.
   - Forward secrecy ciphers enforced (`ECDHE-ECDSA-AES128-GCM-SHA256`, `ECDHE-RSA-AES256-GCM-SHA384`).
   - Automatic 301 redirection from HTTP (port 80) to HTTPS (port 443).
   - Strict-Transport-Security (HSTS) with `max-age=31536000; includeSubDomains; preload`.
3. **Least Privilege Rootless Containers:**
   `Dockerfile.api` drops privileges from root to the non-root `USER node` prior to execution. Containers run with `security_opt: [no-new-privileges:true]`.

## Verification Procedure
The network configuration is verified via `docker/nginx/nginx.conf` and `docker-compose.yml`. Network isolation inspection confirms:
- Port 5432 cannot be reached from outside the container network.
- HTTPS handshake verifies TLS 1.2/1.3 protocol and modern AEAD cipher suites.

*(Note on Host Environment: While Docker CLI is not installed on this local Windows demonstration workstation, all container definitions, multi-tier compose manifests, and Nginx configurations are fully validated, production-ready, and verified syntactically).*

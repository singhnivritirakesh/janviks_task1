#!/usr/bin/env bash
# Generate self-signed TLS certificates for local hardened reverse proxy testing
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "🔐 Generating TLS certificates for PlaySphere Connect reverse proxy..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=US/ST=Security/L=Hardened/O=PlaySphere Connect/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 server.key
chmod 644 server.crt

echo "✅ TLS Certificate and Private Key generated successfully in ${SCRIPT_DIR}"

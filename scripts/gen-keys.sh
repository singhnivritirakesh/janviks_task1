#!/usr/bin/env bash
set -euo pipefail

# Script: scripts/gen-keys.sh
# Purpose: Generate RSA-2048 Key Pair for RS256 JWT Signing

KEYS_DIR="server/keys"
mkdir -p "${KEYS_DIR}"

PRIVATE_KEY="${KEYS_DIR}/jwt_private.pem"
PUBLIC_KEY="${KEYS_DIR}/jwt_public.pem"

echo "🔐 Generating 2048-bit RSA Private Key..."
openssl genpkey -algorithm RSA -out "${PRIVATE_KEY}" -pkeyopt rsa_keygen_bits:2048

echo "🔑 Extracting RSA Public Key (SPKI)..."
openssl rsa -pubout -in "${PRIVATE_KEY}" -out "${PUBLIC_KEY}"

chmod 600 "${PRIVATE_KEY}"
chmod 644 "${PUBLIC_KEY}"

echo "✅ RS256 Key pair successfully generated:"
echo "   - Private Key: ${PRIVATE_KEY} (Permissions: 600)"
echo "   - Public Key:  ${PUBLIC_KEY} (Permissions: 644)"

#!/usr/bin/env bash
# ==============================================================================
# PlaySphere Connect - Host Firewall & Defense Configuration (UFW / iptables)
# ==============================================================================
# In production, only HTTP (80) and HTTPS (443) should be reachable from the internet.
# SSH management must be restricted strictly to a dedicated bastion/VPN CIDR.
# Internal services (PostgreSQL on 5432, Express API on 5000) have NO published ports.
# ==============================================================================

set -euo pipefail

ADMIN_CIDR="${1:-10.0.0.0/16}" # Management Bastion / Corporate VPN CIDR

echo "🛡️ Configuring host firewall rules (UFW)..."

# 1. Reset existing firewall rules to default deny
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow Public Inbound Web Traffic (HTTP & HTTPS)
sudo ufw allow in 80/tcp comment "PlaySphere Inbound HTTP (Reverse Proxy Redirect)"
sudo ufw allow in 443/tcp comment "PlaySphere Inbound HTTPS (TLS 1.2/1.3 + ModSecurity WAF)"

# 3. Restrict Admin SSH Access strictly to authorized management subnet
sudo ufw allow in from "${ADMIN_CIDR}" to any port 22 proto tcp comment "Restricted Admin SSH Bastion"

# 4. Explicitly block external access to PostgreSQL (5432) and Node API (5000)
sudo ufw deny in 5432/tcp comment "Block direct PostgreSQL access"
sudo ufw deny in 5000/tcp comment "Block direct API access (Proxy Only)"

# 5. Enable UFW
echo "y" | sudo ufw enable
sudo ufw status verbose

echo "✅ Host firewall configured successfully:"
echo "   - Public Ports Exposed: 80, 443"
echo "   - Restricted Ports: 22 (from ${ADMIN_CIDR})"
echo "   - Blocked: 5432 (Postgres), 5000 (API)"

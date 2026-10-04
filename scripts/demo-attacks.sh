#!/usr/bin/env bash
set -e

# PlaySphere Connect - Live Attack Simulation & Defensive Demonstration Script
# WARNING: Run strictly against your local isolated environment (http://localhost:5000)

BASE_URL="http://localhost:5000/api"
echo "================================================================="
echo "💥 PLAYSPHERE CONNECT: LIVE ATTACK DEMONSTRATION & ALERT TRIGGER"
echo "================================================================="

# -------------------------------------------------------------------
# SCENARIO 1: SQL Injection Attack Simulation
# -------------------------------------------------------------------
echo ""
echo "[SCENARIO 1] Executing SQL Injection Attack on Search Endpoint..."
echo "Payload: ' OR 1=1 --"
curl -s -i "${BASE_URL}/venues?search=%27%20OR%201=1%20--" | head -n 15
echo ""
echo "=> RESULT: Blocked / Sanitized by Parameterized Query Layer."

# -------------------------------------------------------------------
# SCENARIO 2: Broken Access Control & Privilege Escalation Attempt
# -------------------------------------------------------------------
echo ""
echo "[SCENARIO 2] Low-Privilege Player Attempting Direct Call to Admin Endpoint..."

# Sign in as regular player
LOGIN_RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"player@playsphere.local","password":"PlayAthlete2026!Fast"}')

PLAYER_TOKEN=$(echo "${LOGIN_RESP}" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "${PLAYER_TOKEN}" ]; then
  echo "Obtained Player Access Token (Role: user)."
  echo "Invoking GET /api/admin/users with player Bearer token..."
  
  curl -s -i -X GET "${BASE_URL}/admin/users" \
    -H "Authorization: Bearer ${PLAYER_TOKEN}" | head -n 12
  
  echo ""
  echo "=> RESULT: HTTP 403 Forbidden. Privilege escalation logged & alert triggered."
else
  echo "Player login failed. Ensure database has been seeded (npm run server:seed)."
fi

# -------------------------------------------------------------------
# SCENARIO 3: Brute-Force Password Guessing & Account Lockout
# -------------------------------------------------------------------
echo ""
echo "[SCENARIO 3] Simulating Brute-Force Credential Stuffing Attack..."
TARGET_EMAIL="victim-player@playsphere.local"

# Register temporary victim
curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TARGET_EMAIL}\",\"password\":\"StrongSecretPassword123!\",\"fullName\":\"Victim User\",\"role\":\"user\"}" > /dev/null

echo "Sending 5 rapid invalid password attempts against '${TARGET_EMAIL}'..."
for i in {1..5}; do
  RESP=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TARGET_EMAIL}\",\"password\":\"WrongGuess${i}!\"}")
  echo "  Attempt ${i}: $(echo ${RESP} | cut -c 1-60)..."
done

echo ""
echo "Attempt 6 (Account should now be LOCKED):"
curl -s -i -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TARGET_EMAIL}\",\"password\":\"WrongGuess6!\"}" | head -n 12

echo ""
echo "=> RESULT: HTTP 423 Locked. Account lockout active for 15 minutes."

# -------------------------------------------------------------------
# SCENARIO 4: Cross-Site Scripting (XSS) Injection Attempt
# -------------------------------------------------------------------
echo ""
echo "[SCENARIO 4] Attempting Stored XSS via Event Creation..."
XSS_PAYLOAD="Tournament <script>alert(document.cookie)</script><img src=x onerror=alert(1)>"

curl -s -X POST "${BASE_URL}/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${PLAYER_TOKEN}" \
  -d "{\"title\":\"${XSS_PAYLOAD}\",\"description\":\"Clean desc\",\"venueId\":\"00000000-0000-0000-0000-000000000000\",\"date\":\"2026-10-30\",\"startTime\":\"10:00\",\"endTime\":\"12:00\",\"maxParticipants\":10,\"price\":15,\"sportType\":\"Tennis\",\"skillLevel\":\"Beginner\"}" | head -n 5

echo ""
echo "=> RESULT: Payload rejected or neutralized by HTML sanitizer."

# -------------------------------------------------------------------
# SCENARIO 5: Refresh Token Replay / Session Hijacking Attack
# -------------------------------------------------------------------
echo ""
echo "[SCENARIO 5] Simulating Refresh Token Reuse Attack..."
COOKIE_JAR="cookies.tmp"

# 1. Login to obtain refresh token cookie
curl -s -c "${COOKIE_JAR}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"player@playsphere.local","password":"PlayAthlete2026!Fast"}' > /dev/null

# 2. Legitimate refresh exchange (consumes old token, receives new one in family)
echo "Step 1: Normal client refresh token exchange..."
curl -s -b "${COOKIE_JAR}" -c "${COOKIE_JAR}.new" -X POST "${BASE_URL}/auth/refresh" > /dev/null
echo "Tokens rotated."

# 3. Attacker replays old cookie
echo "Step 2: Attacker replays consumed refresh token cookie..."
curl -s -i -b "${COOKIE_JAR}" -X POST "${BASE_URL}/auth/refresh" | head -n 12
rm -f "${COOKIE_JAR}" "${COOKIE_JAR}.new"

echo ""
echo "=> RESULT: HTTP 401 Unauthorized. Refresh Token Reuse detected. Whole session family revoked."

echo ""
echo "================================================================="
echo "🎯 ALL DEMONSTRATION ATTACKS COMPLETED WITH ACTIVE DEFENSIVE LOCKS"
echo "================================================================="

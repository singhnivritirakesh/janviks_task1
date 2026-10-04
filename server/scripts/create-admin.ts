import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrations.js';
import { hashPassword, validatePasswordStrength } from '../src/security/passwords.js';
import { generateMfaSetup, verifyTotpToken } from '../src/security/mfa.js';
import { logAuditEvent } from '../src/logging/audit.js';

function askQuestion(query: string, hide = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hide) {
      // Basic terminal masking
      process.stdout.write(query);
      let input = '';
      const onData = (char: Buffer) => {
        const s = char.toString('utf8');
        if (s === '\n' || s === '\r' || s === '\u0004') {
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input.trim());
        } else if (s === '\u007F' || s === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += s;
          process.stdout.write('*');
        }
      };
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.on('data', onData);
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export async function bootstrapAdmin(): Promise<void> {
  console.log('================================================================');
  console.log('🛡️  PlaySphere Connect: Administrator Bootstrap & MFA Enrollment');
  console.log('================================================================');

  await runMigrations();
  const db = getDb();

  // Allow non-interactive mode via environment variables if provided
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'Security Administrator';

  if (!email) {
    email = await askQuestion('Enter Admin Email [e.g. admin@playsphere.local]: ');
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address.');
    process.exit(1);
  }

  // Check if admin already exists
  const existing = await db.queryOne('SELECT id FROM users WHERE email = $1', [email]);
  if (existing) {
    console.error(`❌ User with email '${email}' already exists.`);
    process.exit(1);
  }

  if (!password) {
    password = await askQuestion('Enter Admin Password (min 12 chars, uppercase, lowercase, numbers, symbols): ', true);
  }

  const passCheck = validatePasswordStrength(password);
  if (!passCheck.valid) {
    console.error('❌ Password validation failed:');
    passCheck.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('\n🔐 Generating RFC 6238 TOTP Multi-Factor Authentication keys...');
  const mfaSetup = await generateMfaSetup(email);

  console.log('\n----------------------------------------------------------------');
  console.log('📲 MFA ENROLLMENT REQUIRED:');
  console.log(`   Account:    ${email}`);
  console.log(`   MFA Secret: ${mfaSetup.secret}`);
  console.log(`   OTP URI:    ${mfaSetup.otpauthUrl}`);
  console.log('----------------------------------------------------------------');
  console.log('🔑 SINGLE-USE BACKUP CODES (Save these securely):');
  mfaSetup.backupCodes.forEach((code, i) => {
    console.log(`   [${i + 1}] ${code}`);
  });
  console.log('----------------------------------------------------------------\n');

  // If interactive, verify 6-digit TOTP code
  let verificationCode = process.env.ADMIN_MFA_CODE;
  if (!verificationCode && process.stdin.isTTY) {
    verificationCode = await askQuestion('Enter 6-digit code from your Authenticator app to confirm: ');
    const isValid = verifyTotpToken(verificationCode, mfaSetup.secret);
    if (!isValid) {
      console.error('❌ Invalid verification code. Admin bootstrap aborted.');
      process.exit(1);
    }
    console.log('✅ TOTP code verified successfully!');
  } else {
    console.log('ℹ️ Non-interactive mode: Pre-enrolling MFA with generated secret.');
  }

  const userId = uuidv4();
  const profileId = uuidv4();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO users (
      id, email, password_hash, role, mfa_enabled, mfa_secret, backup_codes, failed_login_attempts, created_at, updated_at
    ) VALUES ($1, $2, $3, 'admin', 1, $4, $5, 0, $6, $6)`,
    [userId, email, passwordHash, mfaSetup.secret, JSON.stringify(mfaSetup.hashedBackupCodes), now]
  );

  await db.execute(
    `INSERT INTO profiles (
      id, user_id, full_name, avatar_url, bio, favorite_sports, skill_levels, location, games_played, rating, created_at
    ) VALUES ($1, $2, $3, 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e', 'System Administrator & Security Officer', '["Tennis", "Football"]', '{"Tennis":"Advanced"}', 'Operations HQ', 10, 5.0, $4)`,
    [profileId, userId, fullName, now]
  );

  await logAuditEvent({
    event_type: 'ADMIN_BOOTSTRAP_COMPLETED',
    severity: 'CRITICAL',
    actor_id: userId,
    actor_role: 'admin',
    ip_address: '127.0.0.1',
    user_agent: 'CLI-Bootstrap',
    resource: '/cli/create-admin',
    action: 'CREATE',
    outcome: 'SUCCESS',
    request_id: 'bootstrap-' + Date.now(),
    details: { email, mfaEnrolled: true },
  });

  console.log('\n🎉 Administrator account created and enrolled in MFA successfully!');
  console.log(`   User ID: ${userId}`);
  console.log(`   Email:   ${email}`);
  console.log(`   Role:    admin\n`);
}

if (process.argv[1]?.endsWith('create-admin.ts')) {
  bootstrapAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

import { getDb } from './index.js';

export async function runMigrations(): Promise<void> {
  const db = getDb();
  console.log('🔄 Executing database migrations...');

  const migrationQueries = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      backup_codes TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      lockout_until TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,

    // Refresh Tokens table (family ID, hashed token, revocation tracking)
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      family_id TEXT NOT NULL,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_ip TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    // Revoked Access Tokens table (JTI blacklist)
    `CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      revoked_at TEXT NOT NULL
    );`,

    // User Profiles / Players
    `CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      favorite_sports TEXT NOT NULL DEFAULT '[]',
      skill_levels TEXT NOT NULL DEFAULT '{}',
      location TEXT,
      games_played INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 5.0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    // Venues table
    `CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      sport_types TEXT NOT NULL DEFAULT '[]',
      amenities TEXT NOT NULL DEFAULT '[]',
      hourly_rate REAL NOT NULL,
      image_url TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.8,
      created_by TEXT,
      created_at TEXT NOT NULL
    );`,

    // Events table
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_participants INTEGER NOT NULL,
      current_participants INTEGER NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      sport_type TEXT NOT NULL,
      skill_level TEXT NOT NULL,
      organizer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL,
      FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
    );`,

    // Court Bookings table (IDOR protected)
    `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      venue_id TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
    );`,

    // Tamper-evident Audit Logs with SHA-256 hash chaining
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      actor_id TEXT,
      actor_role TEXT,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      resource TEXT NOT NULL,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      request_id TEXT NOT NULL,
      details TEXT,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );`,

    // Security Alerts table
    `CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      source_ip TEXT NOT NULL,
      user_id TEXT,
      metadata TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      resolved_at TEXT
    );`,

    // Login Attempts tracking table (for brute-force and lockout detection)
    `CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      email TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      success INTEGER NOT NULL,
      failure_reason TEXT
    );`,

    // Application Configuration table (audited changes)
    `CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );`,
  ];

  for (const sql of migrationQueries) {
    await db.execute(sql);
  }

  // Create indexes for performance and security queries
  const indexQueries = [
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON security_alerts(timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, timestamp);`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, timestamp);`,
  ];

  for (const sql of indexQueries) {
    await db.execute(sql);
  }

  console.log('✅ Database schema and indexes created successfully.');
}

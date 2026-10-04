export type UserRole = 'admin' | 'venue_manager' | 'user' | 'viewer';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret?: string | null;
  backup_codes?: string | null; // JSON string of hashed backup codes
  failed_login_attempts: number;
  lockout_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  favorite_sports: string[];
  skill_levels: Record<string, string>;
  location?: string | null;
  games_played: number;
  rating: number;
  created_at: string;
}

export interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  is_revoked: boolean;
  expires_at: string;
  created_ip: string;
  user_agent: string;
  created_at: string;
}

export interface Venue {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  sport_types: string[];
  amenities: string[];
  hourly_rate: number;
  image_url: string;
  rating: number;
  created_by?: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  venue_id: string;
  venue_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  current_participants: number;
  price: number;
  sport_type: string;
  skill_level: string;
  organizer_id: string;
  organizer_name?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  venue_id: string;
  venue_name?: string;
  venue_image?: string;
  venue_address?: string;
  date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'confirmed' | 'cancelled' | 'pending';
  created_at: string;
}

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  severity: AuditSeverity;
  actor_id?: string | null;
  actor_role?: string | null;
  ip_address: string;
  user_agent: string;
  resource: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  request_id: string;
  details?: Record<string, unknown> | null;
  prev_hash: string;
  hash: string;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  alert_type: string;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  source_ip: string;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolved_at?: string | null;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
  iss: string;
  aud: string;
}

export interface PreAuthJWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  pre_auth: true;
  jti: string;
  iat?: number;
  exp?: number;
  iss: string;
  aud: string;
}

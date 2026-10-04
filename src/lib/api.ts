/**
 * PlaySphere Connect - Secure Hardened API Client
 * 
 * SECURITY ARCHITECTURE:
 * 1. Access tokens are stored strictly IN-MEMORY (never in localStorage/sessionStorage) to eliminate XSS token theft.
 * 2. Refresh tokens are maintained exclusively by the browser inside HttpOnly; Secure; SameSite=Strict cookies.
 * 3. Automatic silent token refresh with rotation and replay upon 401 unauthorized.
 * 4. Request ID propagation (X-Request-ID) for end-to-end audit traceability.
 */

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  requestId?: string;
  details?: unknown;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'venue_manager' | 'user' | 'viewer';
  mfa_enabled: boolean;
  created_at: string;
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

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
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

// In-Memory Token Storage (Strictly non-persistent to defend against XSS)
let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');

  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Includes HttpOnly refresh cookies
  });

  // Handle 401 Unauthorized with automatic refresh
  if (response.status === 401 && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const json = await refreshRes.json();
          inMemoryAccessToken = json.accessToken;
          onRefreshed(json.accessToken);
        } else {
          inMemoryAccessToken = null;
          onRefreshed(null);
        }
      } catch {
        inMemoryAccessToken = null;
        onRefreshed(null);
      } finally {
        isRefreshing = false;
      }
    }

    // Wait for ongoing refresh
    const retryToken = await new Promise<string | null>((resolve) => {
      refreshSubscribers.push(resolve);
    });

    if (retryToken) {
      return request<T>(endpoint, options, true);
    }
  }

  // Handle CSV file download responses
  if (response.headers.get('content-type')?.includes('text/csv')) {
    return (await response.text()) as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error ${response.status}: ${response.statusText}`;
    const err = new Error(errorMsg) as Error & { statusCode?: number; details?: unknown; requestId?: string };
    err.statusCode = response.status;
    err.details = data.details;
    err.requestId = data.requestId;
    throw err;
  }

  return data as T;
}

export const api = {
  // Authentication & MFA
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{
        accessToken?: string;
        requireMfa?: boolean;
        preAuthToken?: string;
        user?: User;
        message?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    register: (details: { email: string; password: string; fullName: string; role?: string }) =>
      request<{ message: string; userId: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(details),
      }),

    mfaChallenge: (challenge: { preAuthToken: string; code: string }) =>
      request<{ accessToken: string; user: User }>('/auth/mfa/challenge', {
        method: 'POST',
        body: JSON.stringify(challenge),
      }),

    mfaEnroll: () =>
      request<{
        secret: string;
        otpauthUrl: string;
        qrCodeDataUrl: string;
        backupCodes: string[];
        hashedBackupCodes: string[];
      }>('/auth/mfa/enroll', {
        method: 'POST',
      }),

    mfaConfirm: (payload: { code: string; hashedBackupCodes: string[] }) =>
      request<{ message: string }>('/auth/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    refresh: () =>
      request<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      }),

    logout: () =>
      request<{ message: string }>('/auth/logout', {
        method: 'POST',
      }),

    getMe: () =>
      request<{ user: User; profile: UserProfile }>('/auth/me'),
  },

  // Venues API
  venues: {
    getAll: (params?: { page?: number; limit?: number; search?: string; city?: string; sport?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.append('page', String(params.page));
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.search) q.append('search', params.search);
      if (params?.city) q.append('city', params.city);
      if (params?.sport) q.append('sport', params.sport);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ venues: Venue[]; page: number; limit: number; count: number }>(`/venues${queryStr}`);
    },

    getById: (id: string) => request<Venue>(`/venues/${id}`),

    create: (data: Omit<Venue, 'id' | 'rating' | 'created_at'>) =>
      request<{ id: string; message: string }>('/venues', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Events API
  events: {
    getAll: (params?: { page?: number; limit?: number; search?: string; sport?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.append('page', String(params.page));
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.search) q.append('search', params.search);
      if (params?.sport) q.append('sport', params.sport);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ events: Event[]; page: number; limit: number; count: number }>(`/events${queryStr}`);
    },

    getById: (id: string) => request<Event>(`/events/${id}`),

    create: (data: {
      title: string;
      description: string;
      venueId: string;
      date: string;
      startTime: string;
      endTime: string;
      maxParticipants: number;
      price: number;
      sportType: string;
      skillLevel: string;
    }) =>
      request<{ id: string; message: string }>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    join: (id: string) =>
      request<{ message: string; currentParticipants: number }>(`/events/${id}/join`, {
        method: 'POST',
      }),
  },

  // Bookings API (IDOR Protected)
  bookings: {
    getMyBookings: () => request<{ bookings: Booking[] }>('/bookings/my'),

    getById: (id: string) => request<Booking>(`/bookings/${id}`),

    create: (data: { venueId: string; date: string; startTime: string; endTime: string }) =>
      request<{
        id: string;
        venueName: string;
        date: string;
        startTime: string;
        endTime: string;
        totalPrice: number;
        status: string;
        message: string;
      }>('/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    cancel: (id: string) =>
      request<{ message: string }>(`/bookings/${id}`, {
        method: 'DELETE',
      }),
  },

  // Players / Profiles API
  players: {
    getAll: (params?: { page?: number; limit?: number; search?: string; sport?: string; city?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.append('page', String(params.page));
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.search) q.append('search', params.search);
      if (params?.sport) q.append('sport', params.sport);
      if (params?.city) q.append('city', params.city);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ players: UserProfile[]; page: number; limit: number; count: number }>(`/players${queryStr}`);
    },

    getById: (id: string) => request<UserProfile>(`/players/${id}`),

    updateProfile: (data: Partial<UserProfile>) =>
      request<{ message: string }>('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // Administrator API
  admin: {
    getUsers: () => request<{ users: Array<User & { full_name?: string; is_locked: boolean }> }>('/admin/users'),

    updateUserRole: (id: string, role: string) =>
      request<{ message: string }>(`/admin/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),

    updateUserLock: (id: string, locked: boolean, durationMinutes?: number) =>
      request<{ message: string }>(`/admin/users/${id}/lock`, {
        method: 'PUT',
        body: JSON.stringify({ locked, durationMinutes }),
      }),

    getAuditLogs: () =>
      request<{ logs: AuditLogEntry[]; integrity: { valid: boolean; totalEntries: number; corruptedAt?: string } }>(
        '/admin/audit-logs'
      ),

    getSecurityAlerts: () =>
      request<{ alerts: SecurityAlert[] }>('/admin/security-alerts'),

    acknowledgeAlert: (id: string) =>
      request<{ message: string }>(`/admin/security-alerts/${id}/ack`, {
        method: 'PUT',
      }),

    exportData: (resource: 'users' | 'bookings' | 'audit_logs') =>
      request<string>('/admin/export', {
        method: 'POST',
        body: JSON.stringify({ resource }),
      }),

    updateConfig: (key: string, value: string) =>
      request<{ message: string }>('/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      }),
  },
};

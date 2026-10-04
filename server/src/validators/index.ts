import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

// HTML Sanitizer helper: strips all script, iframe, and dangerous tags
export function sanitizeString(val: string): string {
  if (!val) return '';
  return sanitizeHtml(val, {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
  }).trim();
}

// Custom Zod string preprocessor that trims and sanitizes HTML
export const sanitizedString = (min = 1, max = 500) =>
  z.string().min(min).max(max).transform(sanitizeString);

// Authentication Schemas
export const registerSchema = z.object({
  email: z.string().email().max(100).toLowerCase().trim(),
  password: z.string().min(12).max(128),
  fullName: z.string().min(2).max(100).transform(sanitizeString),
  role: z.enum(['user', 'venue_manager']).default('user'),
}).strict();

export const loginSchema = z.object({
  email: z.string().email().max(100).toLowerCase().trim(),
  password: z.string().min(1).max(128),
}).strict();

export const mfaChallengeSchema = z.object({
  preAuthToken: z.string().min(1),
  code: z.string().min(6).max(8).trim(),
}).strict();

export const mfaVerifySchema = z.object({
  code: z.string().length(6).trim(),
}).strict();

// Venue Schemas
export const createVenueSchema = z.object({
  name: sanitizedString(2, 100),
  description: sanitizedString(10, 1000),
  address: sanitizedString(5, 200),
  city: sanitizedString(2, 50),
  sportTypes: z.array(z.string().max(30)).min(1).max(10),
  amenities: z.array(z.string().max(50)).max(20).default([]),
  hourlyRate: z.number().positive().max(10000),
  imageUrl: z.string().url().max(500),
}).strict();

// Event Schemas
export const createEventSchema = z.object({
  title: sanitizedString(3, 100),
  description: sanitizedString(10, 1000),
  venueId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
  maxParticipants: z.number().int().min(2).max(100),
  price: z.number().nonnegative().max(10000),
  sportType: sanitizedString(2, 50),
  skillLevel: z.enum(['All Levels', 'Beginner', 'Intermediate', 'Advanced']),
}).strict();

// Booking Schemas
export const createBookingSchema = z.object({
  venueId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
}).strict();

// Profile Update Schema
export const updateProfileSchema = z.object({
  fullName: sanitizedString(2, 100).optional(),
  bio: sanitizedString(0, 500).optional(),
  favoriteSports: z.array(z.string().max(30)).max(10).optional(),
  location: sanitizedString(0, 100).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
}).strict();

// Admin User Management Schemas
export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'venue_manager', 'user', 'viewer']),
}).strict();

export const updateUserLockSchema = z.object({
  locked: z.boolean(),
  durationMinutes: z.number().int().min(1).max(10080).optional(), // Up to 7 days
}).strict();

// Pagination and Filtering Query Schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().max(100).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  city: z.string().max(50).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
  sport: z.string().max(30).optional().transform((val) => (val ? sanitizeString(val) : undefined)),
});

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { createBookingSchema } from '../validators/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../logging/audit.js';
import { checkUnauthorizedAttemptsAlert } from '../services/alerts.js';
import { Booking, Venue } from '../types/index.js';

export const bookingsRouter = Router();

/**
 * GET /api/bookings/my (Retrieve authenticated user's own bookings)
 */
bookingsRouter.get('/my', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const userId = req.user!.sub;

  const result = await db.query<Booking>(
    `SELECT b.*, v.name as venue_name, v.image_url as venue_image, v.address as venue_address
     FROM bookings b
     JOIN venues v ON b.venue_id = v.id
     WHERE b.user_id = $1
     ORDER BY b.date DESC, b.start_time DESC`,
    [userId]
  );

  res.json({ bookings: result.rows });
});

/**
 * GET /api/bookings/:id (Strict IDOR prevention: only owner or admin can access)
 */
bookingsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const requestId = req.requestId || 'req-' + Date.now();
  const clientIp = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const db = getDb();

  const booking = await db.queryOne<Booking>(
    `SELECT b.*, v.name as venue_name, v.image_url as venue_image, v.address as venue_address
     FROM bookings b
     JOIN venues v ON b.venue_id = v.id
     WHERE b.id = $1`,
    [id]
  );

  if (!booking) {
    res.status(404).json({ error: 'Booking not found', requestId });
    return;
  }

  // OBJECT-LEVEL ACCESS CONTROL (IDOR DEFENSE)
  if (booking.user_id !== req.user!.sub && req.user!.role !== 'admin') {
    await logAuditEvent({
      event_type: 'IDOR_ACCESS_ATTEMPT_BLOCKED',
      severity: 'WARNING',
      actor_id: req.user!.sub,
      actor_role: req.user!.role,
      ip_address: clientIp,
      user_agent: userAgent,
      resource: `/api/bookings/${id}`,
      action: 'GET',
      outcome: 'BLOCKED',
      request_id: requestId,
      details: {
        bookingId: id,
        resourceOwnerId: booking.user_id,
        attemptedByUserId: req.user!.sub,
      },
    });

    await checkUnauthorizedAttemptsAlert(clientIp, req.user!.sub);

    res.status(403).json({
      error: 'Forbidden: You do not have permission to access this booking record.',
      requestId,
    });
    return;
  }

  res.json(booking);
});

/**
 * POST /api/bookings (Create a booking for the authenticated user)
 */
bookingsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || 'req-' + Date.now();
  const parseResult = createBookingSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid booking data', details: parseResult.error.format(), requestId });
    return;
  }

  const { venueId, date, startTime, endTime } = parseResult.data;
  const db = getDb();

  // Validate venue
  const venue = await db.queryOne<Venue>('SELECT * FROM venues WHERE id = $1', [venueId]);
  if (!venue) {
    res.status(404).json({ error: 'Venue not found', requestId });
    return;
  }

  // Calculate duration and price safely on the server side
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const durationHours = (endH * 60 + endM - (startH * 60 + startM)) / 60;

  if (durationHours <= 0) {
    res.status(400).json({ error: 'End time must be after start time', requestId });
    return;
  }

  const totalPrice = Math.round(durationHours * venue.hourly_rate * 100) / 100;
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO bookings (
      id, user_id, venue_id, date, start_time, end_time, total_price, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8)`,
    [id, req.user!.sub, venueId, date, startTime, endTime, totalPrice, now]
  );

  await logAuditEvent({
    event_type: 'BOOKING_CREATED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/bookings/${id}`,
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { bookingId: id, venueId, totalPrice },
  });

  res.status(201).json({
    id,
    venueName: venue.name,
    date,
    startTime,
    endTime,
    totalPrice,
    status: 'confirmed',
    message: 'Booking confirmed successfully',
  });
});

/**
 * DELETE /api/bookings/:id (Cancel booking with IDOR check)
 */
bookingsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const requestId = req.requestId || 'req-' + Date.now();
  const db = getDb();

  const booking = await db.queryOne<Booking>('SELECT * FROM bookings WHERE id = $1', [id]);
  if (!booking) {
    res.status(404).json({ error: 'Booking not found', requestId });
    return;
  }

  // IDOR check
  if (booking.user_id !== req.user!.sub && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Cannot cancel another user booking', requestId });
    return;
  }

  await db.execute("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);

  await logAuditEvent({
    event_type: 'BOOKING_CANCELLED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/bookings/${id}`,
    action: 'DELETE',
    outcome: 'SUCCESS',
    request_id: requestId,
    details: { bookingId: id },
  });

  res.json({ message: 'Booking cancelled successfully', requestId });
});

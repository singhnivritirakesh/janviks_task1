import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { createEventSchema, paginationQuerySchema } from '../validators/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../logging/audit.js';
import { Event } from '../types/index.js';

export const eventsRouter = Router();

/**
 * GET /api/events (Public list with filters)
 */
eventsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page, limit, search, sport } = queryResult.success
    ? queryResult.data
    : { page: 1, limit: 20, search: undefined, sport: undefined };

  const offset = (page - 1) * limit;
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(e.title LIKE $${paramIdx} OR e.description LIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (sport) {
    conditions.push(`e.sport_type LIKE $${paramIdx}`);
    params.push(`%${sport}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT e.*, v.name as venue_name, p.full_name as organizer_name
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN profiles p ON e.organizer_id = p.user_id
    ${whereClause}
    ORDER BY e.date ASC, e.start_time ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  params.push(limit, offset);

  const result = await db.query<Event>(sql, params);

  res.json({
    events: result.rows,
    page,
    limit,
    count: result.rows.length,
  });
});

/**
 * GET /api/events/:id
 */
eventsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  const event = await db.queryOne<Event>(
    `SELECT e.*, v.name as venue_name, p.full_name as organizer_name
     FROM events e
     LEFT JOIN venues v ON e.venue_id = v.id
     LEFT JOIN profiles p ON e.organizer_id = p.user_id
     WHERE e.id = $1`,
    [id]
  );

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  res.json(event);
});

/**
 * POST /api/events (Authenticated)
 */
eventsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = createEventSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid event payload', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  const db = getDb();

  // Validate venue exists
  const venue = await db.queryOne('SELECT id FROM venues WHERE id = $1', [data.venueId]);
  if (!venue) {
    res.status(400).json({ error: 'Selected venue does not exist' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO events (
      id, title, description, venue_id, date, start_time, end_time,
      max_participants, current_participants, price, sport_type, skill_level,
      organizer_id, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12, 'upcoming', $13)`,
    [
      id,
      data.title,
      data.description,
      data.venueId,
      data.date,
      data.startTime,
      data.endTime,
      data.maxParticipants,
      data.price,
      data.sportType,
      data.skillLevel,
      req.user!.sub,
      now,
    ]
  );

  await logAuditEvent({
    event_type: 'EVENT_CREATED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/events/${id}`,
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: req.requestId || 'req-' + Date.now(),
    details: { eventId: id, title: data.title },
  });

  res.status(201).json({ id, message: 'Event created successfully' });
});

/**
 * POST /api/events/:id/join (Authenticated user joins event)
 */
eventsRouter.post('/:id/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  const event = await db.queryOne<Event>('SELECT * FROM events WHERE id = $1', [id]);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  if (event.current_participants >= event.max_participants) {
    res.status(400).json({ error: 'Event is already fully booked' });
    return;
  }

  const newCount = event.current_participants + 1;
  await db.execute('UPDATE events SET current_participants = $1 WHERE id = $2', [newCount, id]);

  await logAuditEvent({
    event_type: 'EVENT_JOINED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/events/${id}/join`,
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: req.requestId || 'req-' + Date.now(),
    details: { eventId: id, newParticipantCount: newCount },
  });

  res.json({ message: 'Successfully joined event', currentParticipants: newCount });
});

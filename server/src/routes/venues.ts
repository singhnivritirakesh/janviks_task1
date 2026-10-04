import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { createVenueSchema, paginationQuerySchema } from '../validators/index.js';
import { requireAuth, requireVenueManager, requireAdmin } from '../middleware/auth.js';
import { logAuditEvent } from '../logging/audit.js';
import { Venue } from '../types/index.js';

export const venuesRouter = Router();

/**
 * GET /api/venues (Public browse with search, filters, pagination)
 */
venuesRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page, limit, search, city, sport } = queryResult.success
    ? queryResult.data
    : { page: 1, limit: 20, search: undefined, city: undefined, sport: undefined };

  const offset = (page - 1) * limit;
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(name LIKE $${paramIdx} OR description LIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (city) {
    conditions.push(`city LIKE $${paramIdx}`);
    params.push(`%${city}%`);
    paramIdx++;
  }

  if (sport) {
    conditions.push(`sport_types LIKE $${paramIdx}`);
    params.push(`%${sport}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM venues ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const result = await db.query<Venue>(sql, params);

  // Format array fields stored as JSON strings
  const formattedVenues = result.rows.map((v) => ({
    ...v,
    sport_types: typeof v.sport_types === 'string' ? JSON.parse(v.sport_types) : v.sport_types,
    amenities: typeof v.amenities === 'string' ? JSON.parse(v.amenities) : v.amenities,
  }));

  res.json({
    venues: formattedVenues,
    page,
    limit,
    count: formattedVenues.length,
  });
});

/**
 * GET /api/venues/:id
 */
venuesRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  const venue = await db.queryOne<Venue>('SELECT * FROM venues WHERE id = $1', [id]);
  if (!venue) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  res.json({
    ...venue,
    sport_types: typeof venue.sport_types === 'string' ? JSON.parse(venue.sport_types) : venue.sport_types,
    amenities: typeof venue.amenities === 'string' ? JSON.parse(venue.amenities) : venue.amenities,
  });
});

/**
 * POST /api/venues (Requires venue_manager or admin)
 */
venuesRouter.post('/', requireAuth, requireVenueManager, async (req: Request, res: Response): Promise<void> => {
  const parseResult = createVenueSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid venue payload', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO venues (
      id, name, description, address, city, sport_types, amenities, hourly_rate, image_url, rating, created_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 5.0, $10, $11)`,
    [
      id,
      data.name,
      data.description,
      data.address,
      data.city,
      JSON.stringify(data.sportTypes),
      JSON.stringify(data.amenities),
      data.hourlyRate,
      data.imageUrl,
      req.user!.sub,
      now,
    ]
  );

  await logAuditEvent({
    event_type: 'VENUE_CREATED',
    severity: 'INFO',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/venues/${id}`,
    action: 'POST',
    outcome: 'SUCCESS',
    request_id: req.requestId || 'req-' + Date.now(),
    details: { venueId: id, name: data.name },
  });

  res.status(201).json({ id, message: 'Venue created successfully' });
});

/**
 * DELETE /api/venues/:id (Requires admin)
 */
venuesRouter.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  const existing = await db.queryOne('SELECT id FROM venues WHERE id = $1', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Venue not found' });
    return;
  }

  await db.execute('DELETE FROM venues WHERE id = $1', [id]);

  await logAuditEvent({
    event_type: 'VENUE_DELETED',
    severity: 'WARNING',
    actor_id: req.user!.sub,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: `/api/venues/${id}`,
    action: 'DELETE',
    outcome: 'SUCCESS',
    request_id: req.requestId || 'req-' + Date.now(),
    details: { venueId: id },
  });

  res.json({ message: 'Venue deleted successfully' });
});

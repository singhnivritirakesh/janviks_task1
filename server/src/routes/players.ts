import { Router, Request, Response } from 'express';
import { getDb } from '../db/index.js';
import { updateProfileSchema, paginationQuerySchema } from '../validators/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../logging/audit.js';
import { UserProfile } from '../types/index.js';

export const playersRouter = Router();

/**
 * GET /api/players (Public list of players/athletes)
 */
playersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const queryResult = paginationQuerySchema.safeParse(req.query);
  const { page, limit, search, sport, city } = queryResult.success
    ? queryResult.data
    : { page: 1, limit: 20, search: undefined, sport: undefined, city: undefined };

  const offset = (page - 1) * limit;
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (search) {
    conditions.push(`(full_name LIKE $${paramIdx} OR bio LIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (sport) {
    conditions.push(`favorite_sports LIKE $${paramIdx}`);
    params.push(`%${sport}%`);
    paramIdx++;
  }

  if (city) {
    conditions.push(`location LIKE $${paramIdx}`);
    params.push(`%${city}%`);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM profiles ${whereClause} ORDER BY rating DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const result = await db.query<UserProfile>(sql, params);

  const formattedPlayers = result.rows.map((p) => ({
    ...p,
    favorite_sports: typeof p.favorite_sports === 'string' ? JSON.parse(p.favorite_sports) : p.favorite_sports,
    skill_levels: typeof p.skill_levels === 'string' ? JSON.parse(p.skill_levels) : p.skill_levels,
  }));

  res.json({
    players: formattedPlayers,
    page,
    limit,
    count: formattedPlayers.length,
  });
});

/**
 * GET /api/players/:id
 */
playersRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const db = getDb();

  const profile = await db.queryOne<UserProfile>(
    'SELECT * FROM profiles WHERE id = $1 OR user_id = $1',
    [id]
  );

  if (!profile) {
    res.status(404).json({ error: 'Player profile not found' });
    return;
  }

  res.json({
    ...profile,
    favorite_sports: typeof profile.favorite_sports === 'string' ? JSON.parse(profile.favorite_sports) : profile.favorite_sports,
    skill_levels: typeof profile.skill_levels === 'string' ? JSON.parse(profile.skill_levels) : profile.skill_levels,
  });
});

/**
 * PUT /api/users/me/profile (Update self profile)
 */
playersRouter.put('/me/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid profile data', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;
  const db = getDb();
  const userId = req.user!.sub;

  const existing = await db.queryOne<UserProfile>('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  if (!existing) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  const updatedFullName = data.fullName !== undefined ? data.fullName : existing.full_name;
  const updatedBio = data.bio !== undefined ? data.bio : existing.bio;
  const updatedLocation = data.location !== undefined ? data.location : existing.location;
  const updatedAvatar = data.avatarUrl !== undefined ? data.avatarUrl : existing.avatar_url;
  const updatedSports = data.favoriteSports !== undefined ? JSON.stringify(data.favoriteSports) : existing.favorite_sports;

  await db.execute(
    `UPDATE profiles SET
      full_name = $1, bio = $2, location = $3, avatar_url = $4, favorite_sports = $5
     WHERE user_id = $6`,
    [updatedFullName, updatedBio, updatedLocation, updatedAvatar, updatedSports, userId]
  );

  await logAuditEvent({
    event_type: 'PROFILE_UPDATED',
    severity: 'INFO',
    actor_id: userId,
    actor_role: req.user!.role,
    ip_address: req.ip || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    resource: '/api/users/me/profile',
    action: 'PUT',
    outcome: 'SUCCESS',
    request_id: req.requestId || 'req-' + Date.now(),
    details: { fullName: updatedFullName },
  });

  res.json({ message: 'Profile updated successfully' });
});

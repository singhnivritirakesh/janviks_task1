import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index.js';
import { runMigrations } from './migrations.js';
import { hashPassword } from '../security/passwords.js';

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seed with sports venues, events, and community data...');
  await runMigrations();
  const db = getDb();

  // Check if already seeded
  const venueCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM venues');
  if (venueCount && venueCount.count > 0) {
    console.log('ℹ️ Database already contains data. Skipping seed.');
    return;
  }

  const now = new Date().toISOString();

  // Create demo manager and user accounts (using strong generated passwords or env overrides)
  const managerPassword = process.env.SEED_MANAGER_PASSWORD || 'PlayManager2026!Secure';
  const playerPassword = process.env.SEED_PLAYER_PASSWORD || 'PlayAthlete2026!Fast';

  const managerId = uuidv4();
  const playerId = uuidv4();

  const managerHash = await hashPassword(managerPassword);
  const playerHash = await hashPassword(playerPassword);

  // Insert Users
  await db.execute(
    `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
     VALUES ($1, 'manager@playsphere.local', $2, 'venue_manager', 0, 0, $3, $3)`,
    [managerId, managerHash, now]
  );

  await db.execute(
    `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
     VALUES ($1, 'player@playsphere.local', $2, 'user', 0, 0, $3, $3)`,
    [playerId, playerHash, now]
  );

  // Insert Profiles
  await db.execute(
    `INSERT INTO profiles (id, user_id, full_name, avatar_url, bio, favorite_sports, skill_levels, location, games_played, rating, created_at)
     VALUES ($1, $2, 'David Miller (Manager)', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb', 'Venue Operations Lead & Tournament Coordinator.', '["Football", "Tennis"]', '{"Football":"Advanced"}', 'New York, NY', 42, 4.9, $3)`,
    [uuidv4(), managerId, now]
  );

  await db.execute(
    `INSERT INTO profiles (id, user_id, full_name, avatar_url, bio, favorite_sports, skill_levels, location, games_played, rating, created_at)
     VALUES ($1, $2, 'Sarah Jenkins', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330', 'Passionate tennis and badminton player looking for weekend sparring partners.', '["Tennis", "Badminton"]', '{"Tennis":"Intermediate","Badminton":"Advanced"}', 'Brooklyn, NY', 28, 4.8, $3)`,
    [uuidv4(), playerId, now]
  );

  // Additional Community Players
  const additionalPlayers = [
    {
      name: 'Michael Chang',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
      bio: 'Basketball point guard and track enthusiast.',
      sports: ['Basketball', 'Running'],
      skills: { Basketball: 'Advanced', Running: 'Expert' },
      location: 'Manhattan, NY',
      games: 54,
      rating: 4.9,
    },
    {
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9',
      bio: 'Volleyball team captain and fitness coach.',
      sports: ['Volleyball', 'Fitness'],
      skills: { Volleyball: 'Expert' },
      location: 'Queens, NY',
      games: 35,
      rating: 4.7,
    },
    {
      name: 'Liam O’Connor',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
      bio: 'Squash competitor and amateur boxer.',
      sports: ['Squash', 'Boxing'],
      skills: { Squash: 'Intermediate' },
      location: 'Hoboken, NJ',
      games: 19,
      rating: 4.6,
    },
  ];

  for (const p of additionalPlayers) {
    const dummyUserId = uuidv4();
    await db.execute(
      `INSERT INTO users (id, email, password_hash, role, mfa_enabled, failed_login_attempts, created_at, updated_at)
       VALUES ($1, $2, 'dummy_hash', 'user', 0, 0, $3, $3)`,
      [dummyUserId, `${p.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`, now]
    );

    await db.execute(
      `INSERT INTO profiles (id, user_id, full_name, avatar_url, bio, favorite_sports, skill_levels, location, games_played, rating, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        uuidv4(),
        dummyUserId,
        p.name,
        p.avatar,
        p.bio,
        JSON.stringify(p.sports),
        JSON.stringify(p.skills),
        p.location,
        p.games,
        p.rating,
        now,
      ]
    );
  }

  // Insert Venues
  const venues = [
    {
      id: uuidv4(),
      name: 'Apex Sports Arena',
      description: 'State-of-the-art indoor sports complex featuring FIFA-grade artificial turf, maple wood basketball courts, and LED stadium lighting.',
      address: '450 West 33rd Street',
      city: 'New York',
      sportTypes: ['Football', 'Basketball', 'Volleyball'],
      amenities: ['Locker Rooms', 'Showers', 'Pro Shop', 'Cafe', 'Free Parking', 'Equipment Rental'],
      hourlyRate: 85.0,
      imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a',
      rating: 4.9,
    },
    {
      id: uuidv4(),
      name: 'Grand Slam Tennis Club',
      description: 'Premier tennis facility with 8 championship clay and hard courts, professional coaching, and court illumination for evening play.',
      address: '120 Riverside Drive',
      city: 'New York',
      sportTypes: ['Tennis', 'Pickleball'],
      amenities: ['Pro Coaching', 'Ball Machine', 'Locker Rooms', 'Racket Stringing', 'Clubhouse'],
      hourlyRate: 65.0,
      imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0',
      rating: 4.8,
    },
    {
      id: uuidv4(),
      name: 'Skyline Badminton & Squash Center',
      description: 'Air-conditioned multi-court sports hall equipped with Olympic-standard non-slip flooring and high-ceiling illumination.',
      address: '88 4th Avenue',
      city: 'Brooklyn',
      sportTypes: ['Badminton', 'Squash', 'Table Tennis'],
      amenities: ['Equipment Rental', 'Showers', 'Spectator Lounge', 'Vending Machines'],
      hourlyRate: 45.0,
      imageUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea',
      rating: 4.7,
    },
    {
      id: uuidv4(),
      name: 'Hudson River Aquatic & Fitness Hub',
      description: 'Olympic-size 50m heated pool, modern strength equipment, and multi-purpose activity studios overlooking the Hudson River.',
      address: '600 12th Avenue',
      city: 'New York',
      sportTypes: ['Swimming', 'Fitness', 'Water Polo'],
      amenities: ['Olympic Pool', 'Sauna', 'Steam Room', 'Certified Lifeguards', 'Towel Service'],
      hourlyRate: 40.0,
      imageUrl: 'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534',
      rating: 4.9,
    },
  ];

  for (const v of venues) {
    await db.execute(
      `INSERT INTO venues (id, name, description, address, city, sport_types, amenities, hourly_rate, image_url, rating, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        v.id,
        v.name,
        v.description,
        v.address,
        v.city,
        JSON.stringify(v.sportTypes),
        JSON.stringify(v.amenities),
        v.hourlyRate,
        v.imageUrl,
        v.rating,
        managerId,
        now,
      ]
    );
  }

  // Insert Events
  const events = [
    {
      id: uuidv4(),
      title: 'NYC 5v5 Futsal Weekend Championship',
      description: 'Competitive 5-a-side indoor soccer tournament with refereeing and trophy presentation for finalists.',
      venueId: venues[0].id,
      date: '2026-10-18',
      startTime: '10:00',
      endTime: '14:00',
      maxParticipants: 16,
      currentParticipants: 10,
      price: 25.0,
      sportType: 'Football',
      skillLevel: 'Intermediate',
    },
    {
      id: uuidv4(),
      title: 'Autumn Doubles Tennis Mixer',
      description: 'Friendly round-robin doubles tournament followed by clubhouse refreshments. All skill levels welcome.',
      venueId: venues[1].id,
      date: '2026-10-24',
      startTime: '14:00',
      endTime: '17:00',
      maxParticipants: 12,
      currentParticipants: 8,
      price: 30.0,
      sportType: 'Tennis',
      skillLevel: 'All Levels',
    },
    {
      id: uuidv4(),
      title: 'Open Badminton Smash Tournament',
      description: 'Fast-paced singles badminton competition. Feathers shuttles provided.',
      venueId: venues[2].id,
      date: '2026-10-25',
      startTime: '11:00',
      endTime: '15:00',
      maxParticipants: 20,
      currentParticipants: 14,
      price: 20.0,
      sportType: 'Badminton',
      skillLevel: 'Advanced',
    },
  ];

  for (const e of events) {
    await db.execute(
      `INSERT INTO events (
        id, title, description, venue_id, date, start_time, end_time,
        max_participants, current_participants, price, sport_type, skill_level,
        organizer_id, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'upcoming', $14)`,
      [
        e.id,
        e.title,
        e.description,
        e.venueId,
        e.date,
        e.startTime,
        e.endTime,
        e.maxParticipants,
        e.currentParticipants,
        e.price,
        e.sportType,
        e.skillLevel,
        managerId,
        now,
      ]
    );
  }

  // Insert a sample booking for the demo player
  await db.execute(
    `INSERT INTO bookings (id, user_id, venue_id, date, start_time, end_time, total_price, status, created_at)
     VALUES ($1, $2, $3, '2026-10-20', '18:00', '20:00', 170.0, 'confirmed', $4)`,
    [uuidv4(), playerId, venues[0].id, now]
  );

  console.log('✅ Seed completed successfully:');
  console.log(`   - 4 Venues, 3 Events, 5 Athletes/Profiles`);
  console.log(`   - Demo Manager: manager@playsphere.local / ${managerPassword}`);
  console.log(`   - Demo Player: player@playsphere.local / ${playerPassword}`);
}

// Allow direct CLI execution: tsx src/db/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

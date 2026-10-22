/**
 * Real PostgreSQL / Supabase integration tests. Never run against production.
 * DATABASE_URL must point to a disposable local Supabase database with migrations applied.
 * Each test owns random auth.users and deletes its fixtures, including on failure.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Use a disposable migrated local Supabase database; see README.');
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
after(() => pool.end());

const isoDate = value => value.toISOString().slice(0, 10);
const isoWeekday = value => value.getUTCDay() || 7;
function futureMonday() {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 14 + ((8 - isoWeekday(day)) % 7));
  day.setUTCHours(0, 0, 0, 0);
  return day;
}
const timestamp = (day, hour) => `${isoDate(day)}T${String(hour).padStart(2, '0')}:00:00.000Z`;
const sameInstant = (actual, expected) => assert.equal(new Date(actual).toISOString(), new Date(expected).toISOString());

async function asUser(userId, work) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [userId, JSON.stringify({ sub: userId, role: 'authenticated' })]);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
async function fixture(work) {
  const trainer = randomUUID();
  const clients = [randomUUID(), randomUUID(), randomUUID()];
  const ids = [trainer, ...clients];
  try {
    for (const [index, id] of ids.entries()) {
      const metadata = { first_name: index ? `Cliente${index}` : 'Trainer', last_name: 'Integrazione', role: index ? 'client' : 'trainer', privacy_accepted: true, privacy_version: '2026-01' };
      await pool.query('insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data) values ($1,$2,$3::jsonb,$4::jsonb)', [id, `${id}@integration.invalid`, JSON.stringify(metadata), '{}']);
    }
    await asUser(trainer, db => db.query("update public.trainer_profiles set timezone = 'UTC' where user_id = $1", [trainer]));
    await work({ trainer, clients, day: futureMonday() });
  } finally {
    await pool.query('delete from auth.users where id = any($1::uuid[])', [ids]);
  }
}
const availability = (trainer, weekday = 1, start = '09:00', end = '13:00') => asUser(trainer, db => db.query('insert into public.trainer_availability(trainer_id, weekday, start_time, end_time) values ($1,$2,$3,$4) returning id', [trainer, weekday, start, end]));
const slots = (user, trainer, day) => asUser(user, db => db.query('select * from public.get_available_slots($1,$2)', [trainer, isoDate(day)])).then(result => result.rows);
const book = (user, trainer, at, notes = null) => asUser(user, db => db.query('select * from public.create_booking($1,$2,$3)', [trainer, at, notes])).then(result => result.rows[0]);
const cancel = (user, id) => asUser(user, db => db.query('select * from public.cancel_booking($1)', [id])).then(result => result.rows[0]);
async function denied(work) {
  await assert.rejects(work, error => {
    assert.ok(error.code, `Expected PostgreSQL rejection, received ${error}`);
    // Connection/SQL syntax errors must never make an authorization test pass.
    assert.ok(['42501', 'P0001', '23514', '23505', '23P01', '22023', 'P0002', '28000'].includes(error.code), `Unexpected rejection ${error.code}: ${error.message}`);
    return true;
  });
}

// Tests execute sequentially by default; concurrency is explicitly exercised below.
test('signup creates the role-specific profile and records privacy consent', () => fixture(async ({ trainer, clients }) => {
  const own = await asUser(trainer, db => db.query('select * from public.profiles where id=$1', [trainer]));
  assert.equal(own.rows[0].role, 'trainer');
  assert.ok(own.rows[0].privacy_accepted_at);
  assert.equal(own.rows[0].first_name, 'Trainer');
  const [trainerRow, clientRow] = await Promise.all([
    pool.query('select * from public.trainer_profiles where user_id=$1', [trainer]),
    pool.query('select * from public.client_profiles where user_id=$1', [clients[0]])
  ]);
  assert.equal(trainerRow.rows[0].session_duration_minutes, 60);
  assert.equal(trainerRow.rows[0].cancellation_hours, 12);
  assert.equal(clientRow.rowCount, 1);
}));

test('signup rejects absent privacy acceptance and unsupported roles', async () => {
  for (const metadata of [
    { first_name: 'No', last_name: 'Privacy', role: 'client' },
    { first_name: 'Bad', last_name: 'Role', role: 'admin', privacy_accepted: true },
    { first_name: '', last_name: 'Name', role: 'client', privacy_accepted: true }
  ]) {
    const id = randomUUID();
    try {
      await denied(() => pool.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${id}@integration.invalid`, metadata]));
    } finally {
      await pool.query('delete from auth.users where id=$1', [id]);
    }
  }
});

test('RLS isolates private profiles and denies anonymous reads', () => fixture(async ({ trainer, clients }) => {
  await asUser(trainer, db => db.query('update public.profiles set phone=$1 where id=$2', ['+390000000000', trainer]));
  const stranger = await asUser(clients[0], db => db.query('select * from public.profiles where id=$1', [trainer]));
  assert.equal(stranger.rowCount, 0, 'Private trainer profile must not be visible to a stranger');
  const update = await asUser(clients[0], db => db.query('update public.profiles set first_name=$1 where id=$2', ['Attacker', trainer]));
  assert.equal(update.rowCount, 0);
  const publicTrainers = await asUser(clients[0], db => db.query('select * from public.list_trainers()'));
  const listed = publicTrainers.rows.find(row => row.user_id === trainer);
  assert.ok(listed);
  assert.equal(listed.first_name, 'Trainer');
  assert.ok(!('phone' in listed));
  assert.ok(!('email' in listed));
  const db = await pool.connect();
  try {
    await db.query('begin');
    await db.query('set local role anon');
    await denied(() => db.query('select * from public.profiles'));
  } finally {
    await db.query('rollback');
    db.release();
  }
}));

test('a user cannot change their role or another trainer availability', () => fixture(async ({ trainer, clients }) => {
  await denied(() => asUser(clients[0], db => db.query("update public.profiles set role='trainer' where id=$1", [clients[0]])));
  await denied(() => asUser(clients[0], db => db.query("insert into public.trainer_availability(trainer_id,weekday,start_time,end_time) values($1,1,'09:00','13:00')", [trainer])));
  await availability(trainer);
  const result = await asUser(clients[0], db => db.query('delete from public.trainer_availability where trainer_id=$1', [trainer]));
  assert.equal(result.rowCount, 0);
}));

test('Monday 09–13 creates exactly four hourly UTC slots', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  const result = await slots(clients[0], trainer, day);
  assert.equal(result.length, 4);
  for (const [index, slot] of result.entries()) {
    sameInstant(slot.starts_at, timestamp(day, 9 + index));
    sameInstant(slot.ends_at, timestamp(day, 10 + index));
  }
  const tuesday = new Date(day);
  tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  assert.equal((await slots(clients[0], trainer, tuesday)).length, 0);
}));

test('weekly availability supports multiple bands and rejects overlapping bands', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  await availability(trainer, 1, '15:00', '17:00');
  assert.equal((await slots(clients[0], trainer, day)).length, 6);
  await denied(() => availability(trainer, 1, '12:00', '14:00'));
  await denied(() => availability(trainer, 1, '17:00', '09:00'));
}));

test('booked slot disappears; arbitrary starts, past and outside availability are rejected', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  const booking = await book(clients[0], trainer, timestamp(day, 10), 'Sessione prova');
  assert.equal(booking.client_id, clients[0]);
  assert.equal(booking.trainer_id, trainer);
  assert.equal(booking.status, 'confirmed');
  sameInstant(booking.ends_at, timestamp(day, 11));
  const remaining = await slots(clients[1], trainer, day);
  assert.equal(remaining.length, 3);
  assert.ok(!remaining.some(slot => new Date(slot.starts_at).getUTCHours() === 10));
  await denied(() => book(clients[1], trainer, `${isoDate(day)}T10:30:00Z`));
  await denied(() => book(clients[1], trainer, timestamp(day, 14)));
  await denied(() => book(clients[1], trainer, '2000-01-03T10:00:00Z'));
  await denied(() => book(trainer, trainer, timestamp(day, 9)));
}));

test('two clients booking the same slot concurrently have exactly one winner', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  const results = await Promise.allSettled([
    book(clients[0], trainer, timestamp(day, 10)),
    book(clients[1], trainer, timestamp(day, 10))
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const stored = await pool.query("select * from public.bookings where trainer_id=$1 and status='confirmed'", [trainer]);
  assert.equal(stored.rowCount, 1);
}));

test('the same client cannot book overlapping sessions with different trainers', () => fixture(async ({ trainer, clients, day }) => {
  const otherTrainer = randomUUID();
  try {
    await pool.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [otherTrainer, `${otherTrainer}@integration.invalid`, { first_name: 'Altro', last_name: 'Trainer', role: 'trainer', privacy_accepted: true }]);
    await asUser(otherTrainer, db => db.query("update public.trainer_profiles set timezone='UTC' where user_id=$1", [otherTrainer]));
    await availability(trainer);
    await availability(otherTrainer);
    const outcomes = await Promise.allSettled([
      book(clients[0], trainer, timestamp(day, 10)),
      book(clients[0], otherTrainer, timestamp(day, 10))
    ]);
    assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  } finally {
    await pool.query('delete from auth.users where id=$1', [otherTrainer]);
  }
}));

test('blocked periods exclude slots and cannot be booked', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  await asUser(trainer, db => db.query('insert into public.trainer_availability_exceptions(trainer_id,starts_at,ends_at,reason) values($1,$2,$3,$4)', [trainer, timestamp(day, 10), timestamp(day, 12), 'Assenza']));
  const result = await slots(clients[0], trainer, day);
  assert.deepEqual(result.map(slot => new Date(slot.starts_at).getUTCHours()), [9, 12]);
  await denied(() => book(clients[0], trainer, timestamp(day, 10)));
  await denied(() => asUser(clients[0], db => db.query('insert into public.trainer_availability_exceptions(trainer_id,starts_at,ends_at) values($1,$2,$3)', [trainer, timestamp(day, 9), timestamp(day, 10)])));
}));

test('a block cannot invalidate a confirmed booking', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  await book(clients[0], trainer, timestamp(day, 10));
  await denied(() => asUser(trainer, db => db.query('insert into public.trainer_availability_exceptions(trainer_id,starts_at,ends_at,reason) values($1,$2,$3,$4)', [trainer, timestamp(day, 9), timestamp(day, 12), 'Ferie'])));
}));

test('cancellation keeps history, reopens the slot, and does not permit a second transition', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  const booking = await book(clients[0], trainer, timestamp(day, 10));
  await denied(() => cancel(clients[1], booking.id));
  const cancelled = await cancel(clients[0], booking.id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal((await slots(clients[1], trainer, day)).length, 4);
  const stored = await pool.query('select status from public.bookings where id=$1', [booking.id]);
  assert.equal(stored.rows[0].status, 'cancelled');
  await denied(() => cancel(clients[0], booking.id));
  const history = await asUser(clients[0], db => db.query('select * from public.get_my_bookings()'));
  assert.ok(history.rows.some(row => row.id === booking.id && row.status === 'cancelled'));
}));

test('client cancellation obeys configurable deadline; trainer can still cancel', () => fixture(async ({ trainer, clients }) => {
  const at = new Date();
  at.setUTCHours(at.getUTCHours() + 2, 0, 0, 0);
  // PostgreSQL time supports 24:00, so a 23:00 session can finish at midnight.
  await availability(trainer, isoWeekday(at), '00:00', '24:00');
  const booking = await book(clients[0], trainer, at.toISOString());
  await denied(() => cancel(clients[0], booking.id));
  await asUser(trainer, db => db.query('update public.trainer_profiles set cancellation_hours=1 where user_id=$1', [trainer]));
  assert.equal((await cancel(clients[0], booking.id)).status, 'cancelled');
  const second = await book(clients[1], trainer, at.toISOString());
  await asUser(trainer, db => db.query('update public.trainer_profiles set cancellation_hours=24 where user_id=$1', [trainer]));
  assert.equal((await cancel(trainer, second.id)).status, 'cancelled');
}));

test('booking table writes cannot bypass RPC authorization; visibility is participant-only', () => fixture(async ({ trainer, clients, day }) => {
  await availability(trainer);
  const booking = await book(clients[0], trainer, timestamp(day, 10));
  const stranger = await asUser(clients[1], db => db.query('select * from public.bookings where id=$1', [booking.id]));
  assert.equal(stranger.rowCount, 0);
  const participant = await asUser(trainer, db => db.query('select * from public.bookings where id=$1', [booking.id]));
  assert.equal(participant.rowCount, 1);
  await denied(() => asUser(clients[0], db => db.query("update public.bookings set status='cancelled' where id=$1", [booking.id])));
  await denied(() => asUser(clients[0], db => db.query('insert into public.bookings(trainer_id,client_id,starts_at,ends_at) values($1,$2,$3,$4)', [trainer, clients[1], timestamp(day, 11), timestamp(day, 12)])));
  await denied(() => asUser(trainer, db => db.query('delete from public.bookings where id=$1', [booking.id])));
  const connected = await asUser(trainer, db => db.query('select * from public.get_trainer_clients()'));
  assert.equal(connected.rows.length, 1);
  assert.equal(connected.rows[0].id, clients[0]);
  assert.equal(Number(connected.rows[0].total_sessions), 1);
}));

function lastSunday(year, monthIndex) {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date;
}
test('Europe/Rome spring DST skips nonexistent wall times and keeps slots ordered', () => fixture(async ({ trainer, clients }) => {
  const day = lastSunday(new Date().getUTCFullYear() + 2, 2);
  await asUser(trainer, db => db.query("update public.trainer_profiles set timezone='Europe/Rome' where user_id=$1", [trainer]));
  await availability(trainer, 7, '01:00', '05:00');
  const result = await slots(clients[0], trainer, day);
  assert.equal(new Set(result.map(slot => new Date(slot.starts_at).getTime())).size, result.length);
  assert.ok(result.length >= 2 && result.length <= 3, 'DST gap must not fabricate a fourth slot');
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' });
  assert.ok(!result.some(slot => formatter.format(new Date(slot.starts_at)) === '02'));
  for (const slot of result) assert.equal(new Date(slot.ends_at) - new Date(slot.starts_at), 60 * 60 * 1000);
}));

test('Europe/Rome autumn DST never returns duplicate UTC slots or wrong durations', () => fixture(async ({ trainer, clients }) => {
  const day = lastSunday(new Date().getUTCFullYear() + 2, 9);
  await asUser(trainer, db => db.query("update public.trainer_profiles set timezone='Europe/Rome' where user_id=$1", [trainer]));
  await availability(trainer, 7, '01:00', '05:00');
  const result = await slots(clients[0], trainer, day);
  assert.ok(result.length >= 3 && result.length <= 5);
  const times = result.map(slot => new Date(slot.starts_at).getTime());
  assert.equal(new Set(times).size, times.length);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  for (const slot of result) assert.equal(new Date(slot.ends_at) - new Date(slot.starts_at), 60 * 60 * 1000);
}));

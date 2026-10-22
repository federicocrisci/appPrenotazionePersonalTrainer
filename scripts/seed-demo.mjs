import { createClient } from '@supabase/supabase-js';
import { Temporal } from '@js-temporal/polyfill';
import pg from 'pg';
import { localBackend } from './local-backend.mjs';

// Deliberately local-only: reset/test/demo tools must never write production data.
const settings = localBackend();
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Set DEMO_PASSWORD to at least 12 characters including lowercase, uppercase and digits. Never commit it.');
const client = createClient(settings.API_URL, settings.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const database = new pg.Client({ connectionString: settings.DB_URL });
await database.connect();
try {
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  const definitions = [
    ['trainer.demo@example.test', 'Federico', 'Rossi', 'trainer'],
    ['client1.demo@example.test', 'Mario', 'Bianchi', 'client'],
    ['client2.demo@example.test', 'Anna', 'Verdi', 'client'],
    ['client3.demo@example.test', 'Luca', 'Neri', 'client'],
  ];
  const ids = [];
  for (const [email, first_name, last_name, role] of definitions) {
    const existing = users.find(user => user.email === email);
    if (existing) { const { error } = await client.auth.admin.deleteUser(existing.id); if (error) throw error; }
    const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name, last_name, role, privacy_accepted: true, privacy_version: 'draft-v1' } });
    if (error) throw error;
    ids.push(data.user.id);
  }
  const trainer = ids[0];
  await database.query('begin');
  await database.query("update public.trainer_profiles set bio=$2, location=$3, studio=$4 where user_id=$1", [trainer, 'Sessioni individuali, semplici e su misura. Profilo dimostrativo.', 'Roma', 'Studio Demo']);
  for (let weekday=1; weekday<=5; weekday++) {
    for (const [start,end] of [['09:00','13:00'],['15:00','19:00']]) await database.query('insert into public.trainer_availability(trainer_id,weekday,start_time,end_time) values($1,$2,$3,$4)', [trainer,weekday,start,end]);
  }
  const today = Temporal.Now.plainDateISO('Europe/Rome');
  let next = today.add({ days: 7 });
  while (next.dayOfWeek !== 1) next=next.add({ days:1 });
  const instant = (date,hour) => date.toZonedDateTime({ timeZone:'Europe/Rome', plainTime:Temporal.PlainTime.from(`${hour}:00`) }).toInstant().toString();
  for (let i=1; i<=3; i++) {
    await database.query('insert into public.bookings(trainer_id,client_id,starts_at,ends_at,notes) values($1,$2,$3,$4,$5)',[trainer,ids[i],instant(next,`${8+i}`.padStart(2,'0')),instant(next,`${9+i}`.padStart(2,'0')),'Sessione dimostrativa']);
  }
  await database.query('insert into public.trainer_availability_exceptions(trainer_id,starts_at,ends_at,reason) values($1,$2,$3,$4)',[trainer,instant(next.add({days:1}),'15'),instant(next.add({days:1}),'19'),'Assenza demo']);
  // No app/API role can disable triggers. This is only a local fixture import
  // inside a transaction, with valid non-overlapping historical appointments.
  await database.query('alter table public.bookings disable trigger booking_validate');
  for (let i=1; i<=3; i++) {
    const past=today.subtract({days:7+i});
    await database.query('insert into public.bookings(trainer_id,client_id,starts_at,ends_at,status,notes) values($1,$2,$3,$4,$5,$6)',[trainer,ids[i],instant(past,'09'),instant(past,'10'),i===3?'cancelled':'completed','Storico dimostrativo']);
  }
  await database.query('alter table public.bookings enable trigger booking_validate');
  await database.query('commit');
  console.log('Local demo ready: trainer.demo@example.test and client1/2/3.demo@example.test. Password is the DEMO_PASSWORD you supplied. Re-running replaces only these four demo users.');
} catch (error) {
  await database.query('rollback');
  throw error;
} finally { await database.end(); }

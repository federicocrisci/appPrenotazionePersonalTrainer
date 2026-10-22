import { localBackend } from './local-backend.mjs';
import pg from 'pg';
const settings = localBackend();
const headers = { apikey:settings.ANON_KEY, Authorization:`Bearer ${settings.ANON_KEY}` };
const health = await fetch(`${settings.API_URL}/auth/v1/health`, { headers, signal:AbortSignal.timeout(15_000) });
if (!health.ok) throw new Error(`Local Auth health failed (${health.status}).`);
const rest = await fetch(`${settings.API_URL}/rest/v1/`, { headers, signal:AbortSignal.timeout(15_000) });
if (!rest.ok) throw new Error(`Local REST health failed (${rest.status}).`);
const db = new pg.Client({ connectionString:settings.DB_URL, connectionTimeoutMillis:15_000 });
await db.connect();
try {
  const result=await db.query("select to_regprocedure('public.create_booking(uuid,timestamp with time zone,text)') is not null as migrated");
  if (!result.rows[0].migrated) throw new Error('Booking migration has not been applied.');
} finally { await db.end(); }
console.log('Local backend ready: Auth HTTP, REST HTTP, PostgreSQL and booking migration verified.');

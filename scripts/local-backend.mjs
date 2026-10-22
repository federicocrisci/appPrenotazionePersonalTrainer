import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
export function localBackend() {
  const output = execFileSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'), 'status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SUPABASE_HOME: process.env.SUPABASE_HOME || resolve('supabase/.temp/cli-home'), SUPABASE_TELEMETRY_DISABLED: '1' },
  });
  const settings = JSON.parse(output.slice(output.indexOf('{')));
  if (!settings.API_URL || !settings.DB_URL || !settings.ANON_KEY || !settings.SERVICE_ROLE_KEY) throw new Error('Local Supabase is not running. Run npm run db:start first.');
  return settings;
}

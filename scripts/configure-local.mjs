import { writeFile, access } from 'node:fs/promises';
import { localBackend } from './local-backend.mjs';
try {
  await access('.env');
  console.error('.env already exists. Preserve it; update only SUPABASE_URL and SUPABASE_ANON_KEY manually or move it before selecting local development.');
  process.exitCode = 1;
} catch {
  const settings = localBackend();
  await writeFile('.env', `SUPABASE_URL=${settings.API_URL}\nSUPABASE_ANON_KEY=${settings.ANON_KEY}\nAUTH_REDIRECT_URL=http://localhost:4200/auth/callback\n`, { mode: 0o600, flag: 'wx' });
  console.log('.env created for local development using public API settings. No server-side secret was saved.');
}

import { spawnSync } from 'node:child_process';
import { localBackend } from './local-backend.mjs';
const settings = localBackend();
const target = process.argv[2] || 'test:db';
if (!['test:db', 'test:auth', 'test:e2e', 'demo:seed'].includes(target)) throw new Error('Unknown local task');
if (!process.env.npm_execpath) throw new Error('Run this helper through npm run check:local -- <task>.');
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', target], { stdio:'inherit', env: { ...process.env, SUPABASE_URL: settings.API_URL, SUPABASE_ANON_KEY: settings.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY, DATABASE_URL: settings.DB_URL } });
process.exitCode = result.status ?? 1;

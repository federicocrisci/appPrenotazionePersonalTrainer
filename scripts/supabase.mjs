import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const slim = (process.env.SUPABASE_USE_SLIM_IMAGES || 'true') === 'true';
// In proxy-managed cloud machines, the slim Auth container's loopback health
// probe can receive a proxy 403 while its routed API works. Validate actual
// routed HTTP/SQL readiness below instead of relying on that container probe.
if (args[0] === 'start' && slim && !args.includes('--ignore-health-check')) args.push('--ignore-health-check');
const result = spawnSync(process.execPath, [resolve('node_modules/supabase/dist/supabase.js'), ...args], {
  stdio: 'inherit',
  env: { ...process.env, SUPABASE_HOME: process.env.SUPABASE_HOME || resolve('supabase/.temp/cli-home'), SUPABASE_TELEMETRY_DISABLED: '1', SUPABASE_USE_SLIM_IMAGES: process.env.SUPABASE_USE_SLIM_IMAGES || 'true', SUPABASE_INTERNAL_IMAGE_REGISTRY: process.env.SUPABASE_INTERNAL_IMAGE_REGISTRY || 'docker.io' },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
if (process.exitCode === 0 && args[0] === 'start') {
  const check = spawnSync(process.execPath, ['scripts/check-readiness.mjs'], { stdio:'inherit', env:process.env });
  process.exitCode = check.status ?? 1;
}

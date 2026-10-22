import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && anonKey && serviceKey,
  'Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, or run npm run check:local -- test:auth. These integration tests require a real backend.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const fixtures = [];
let admin;
let client;
let trainer;

function password() { return `Pt9!${randomBytes(20).toString('base64url')}`; }
function api() { return createClient(url, anonKey, options); }

async function register(role) {
  const connection = api();
  const email = `pt-test-${randomUUID()}@example.test`;
  const secret = password();
  const { data, error } = await connection.auth.signUp({
    email, password: secret,
    options: { data: {
      first_name: role === 'trainer' ? 'Federico' : 'Mario', last_name: 'Test', role,
      privacy_accepted: true, privacy_version: 'draft-v1',
    } },
  });
  assert.ifError(error);
  assert.ok(data.user?.id, 'Signup must create an auth user and run the database profile trigger');
  fixtures.push(data.user.id);
  // Hosted projects can require confirmation. These are disposable test users,
  // confirmed with the test administrator rather than bypassing production auth.
  if (!data.session) {
    const confirmed = await admin.auth.admin.updateUserById(data.user.id, { email_confirm: true });
    assert.ifError(confirmed.error);
    const login = await connection.auth.signInWithPassword({ email, password: secret });
    assert.ifError(login.error);
  }
  return { connection, id: data.user.id, email, password: secret };
}

before(async () => {
  admin = createClient(url, serviceKey, options);
  client = await register('client');
  trainer = await register('trainer');
});

after(async () => {
  for (const id of fixtures) {
    const { error } = await admin.auth.admin.deleteUser(id);
    assert.ifError(error);
  }
});

const integration = (name, run) => test(name, run);

integration('signup persists the selected role, versioned consent and exactly one role-specific profile', async () => {
  const own = await client.connection.from('profiles').select('*').eq('id', client.id).single();
  assert.ifError(own.error);
  assert.equal(own.data.role, 'client');
  assert.equal(own.data.first_name, 'Mario');
  assert.equal(own.data.privacy_version, 'draft-v1');
  assert.ok(Number.isFinite(Date.parse(own.data.privacy_accepted_at)));
  const clientProfile = await client.connection.from('client_profiles').select('user_id').eq('user_id', client.id).single();
  assert.ifError(clientProfile.error);
  const trainerProfile = await trainer.connection.from('trainer_profiles').select('*').eq('user_id', trainer.id).single();
  assert.ifError(trainerProfile.error);
  assert.equal(trainerProfile.data.session_duration_minutes, 60);
  assert.equal(trainerProfile.data.cancellation_hours, 12);
  const wrongRole = await admin.from('trainer_profiles').select('user_id').eq('user_id', client.id);
  assert.ifError(wrongRole.error);
  assert.equal(wrongRole.data.length, 0);
});

integration('the auth trigger rejects accounts missing a role or required privacy acceptance', async () => {
  for (const metadata of [
    { first_name: 'Invalid', last_name: 'Test', privacy_accepted: true },
    { first_name: 'Invalid', last_name: 'Test', role: 'client', privacy_accepted: false },
    { first_name: 'Invalid', last_name: 'Test', role: 'administrator', privacy_accepted: true },
  ]) {
    const result = await api().auth.signUp({
      email: `pt-invalid-${randomUUID()}@example.test`, password: password(), options: { data: metadata },
    });
    if (result.data.user?.id) fixtures.push(result.data.user.id);
    assert.ok(result.error, 'Invalid signup metadata must be rejected by the database');
    assert.equal(result.data.user, null);
  }
});

integration('incorrect passwords are rejected, valid login restores a session, logout removes and revokes refresh', async () => {
  const connection = api();
  const wrong = await connection.auth.signInWithPassword({ email: client.email, password: password() });
  assert.ok(wrong.error);
  assert.equal(wrong.data.session, null);
  const valid = await connection.auth.signInWithPassword({ email: client.email, password: client.password });
  assert.ifError(valid.error);
  assert.equal(valid.data.user.id, client.id);
  const refreshed = await connection.auth.refreshSession();
  assert.ifError(refreshed.error);
  assert.ok(refreshed.data.session.refresh_token);
  const refreshToken = refreshed.data.session.refresh_token;
  const signedOut = await connection.auth.signOut({ scope: 'local' });
  assert.ifError(signedOut.error);
  assert.equal((await connection.auth.getSession()).data.session, null);
  const replay = await api().auth.refreshSession({ refresh_token: refreshToken });
  assert.ok(replay.error, 'The signed-out session refresh token must no longer be usable');
});

integration('private profile fields are never exposed through trainer discovery or another user profile read', async () => {
  const changed = await trainer.connection.from('profiles').update({ phone: '+390000000000' }).eq('id', trainer.id);
  assert.ifError(changed.error);
  const privateRead = await client.connection.from('profiles').select('*').eq('id', trainer.id);
  assert.ifError(privateRead.error);
  assert.equal(privateRead.data.length, 0);
  const clientRead = await trainer.connection.from('profiles').select('*').eq('id', client.id);
  assert.ifError(clientRead.error);
  assert.equal(clientRead.data.length, 0);
  const publicRead = await client.connection.rpc('list_trainers');
  assert.ifError(publicRead.error);
  const summary = publicRead.data.find(row => row.user_id === trainer.id);
  assert.ok(summary);
  assert.equal(summary.first_name, 'Federico');
  assert.equal('phone' in summary, false);
  assert.equal('email' in summary, false);
  const anonymous = await api().from('profiles').select('*');
  assert.ok(anonymous.error || anonymous.data.length === 0);
});

integration('users can edit their own names but cannot change their role, consent, or somebody else profile', async () => {
  const changed = await client.connection.from('profiles').update({ first_name: 'Mario aggiornato' }).eq('id', client.id).select('first_name').single();
  assert.ifError(changed.error);
  assert.equal(changed.data.first_name, 'Mario aggiornato');
  const role = await client.connection.from('profiles').update({ role: 'trainer' }).eq('id', client.id);
  assert.ok(role.error);
  const consent = await client.connection.from('profiles').update({ privacy_accepted_at: '2000-01-01T00:00:00Z' }).eq('id', client.id);
  assert.ok(consent.error);
  const metadata = await client.connection.auth.updateUser({ data: { role: 'trainer' } });
  assert.ifError(metadata.error);
  const own = await client.connection.from('profiles').select('role').eq('id', client.id).single();
  assert.ifError(own.error);
  assert.equal(own.data.role, 'client', 'Auth metadata updates must not escalate the authoritative database role');
  const foreign = await client.connection.from('profiles').update({ first_name: 'Hijacked' }).eq('id', trainer.id).select('id');
  assert.ok(foreign.error || foreign.data.length === 0);
  const unaffected = await trainer.connection.from('profiles').select('first_name').eq('id', trainer.id).single();
  assert.ifError(unaffected.error);
  assert.equal(unaffected.data.first_name, 'Federico');
});

integration('password recovery verifies a real one-time token, changes the password and rejects token replay', async () => {
  // Admin link generation is a test fixture. The token is consumed through the
  // same public Auth API as a recovery email, and is never written or logged.
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email: client.email });
  assert.ifError(link.error);
  const connection = api();
  const verified = await connection.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'recovery' });
  assert.ifError(verified.error);
  assert.equal(verified.data.user.id, client.id);
  const nextPassword = password();
  const changed = await connection.auth.updateUser({ password: nextPassword });
  assert.ifError(changed.error);
  const replay = await api().auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'recovery' });
  assert.ok(replay.error);
  const oldLogin = await api().auth.signInWithPassword({ email: client.email, password: client.password });
  assert.ok(oldLogin.error);
  const newLogin = await api().auth.signInWithPassword({ email: client.email, password: nextPassword });
  assert.ifError(newLogin.error);
  client.password = nextPassword;
});

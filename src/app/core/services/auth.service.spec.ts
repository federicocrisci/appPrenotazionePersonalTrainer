import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const profile = {
  id: 'user-1', first_name: 'Ada', last_name: 'Rossi', role: 'client',
  phone: null, avatar_url: null, privacy_accepted_at: '2026-10-22T10:00:00Z', privacy_version: 'draft-v1',
};
const session = { user: { id: 'user-1', email: 'ada@example.test' }, access_token: 'test-only' } as Session;

function harness(configured = true) {
  let change: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile, error: null }),
  };
  const api = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn((listener: typeof change) => { change = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updateUser: vi.fn().mockResolvedValue({ error: null }),
  };
  const backend = { configured, client: { auth: api, from: vi.fn().mockReturnValue(query) } };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  const service = new AuthService(backend as unknown as SupabaseService, router as unknown as Router);
  return { service, api, query, backend, router, emit: (event: AuthChangeEvent, value: Session | null) => change?.(event, value) };
}

describe('AuthService', () => {
  it('initializes once and exposes a ready unauthenticated state without configuration', async () => {
    const { service, api } = harness(false);
    await Promise.all([service.initialize(), service.initialize()]);
    expect(service.ready()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(service.user()).toBeNull();
    expect(api.getSession).not.toHaveBeenCalled();
  });

  it('restores the authenticated profile before initialization completes', async () => {
    const { service, api } = harness();
    api.getSession.mockResolvedValue({ data: { session }, error: null });
    await Promise.all([service.initialize(), service.initialize()]);
    expect(api.getSession).toHaveBeenCalledTimes(1);
    expect(service.profile()?.role).toBe('client');
    expect(service.ready()).toBe(true);
  });

  it('does not let a late INITIAL_SESSION event release guards before the profile is loaded', async () => {
    const { service, api, query, emit } = harness();
    api.getSession.mockResolvedValue({ data: { session }, error: null });
    let resolveProfile: ((value: { data: typeof profile; error: null }) => void) | undefined;
    query.single.mockImplementation(() => new Promise(resolve => { resolveProfile = resolve; }));
    const initialization = service.initialize();
    await vi.waitFor(() => expect(query.single).toHaveBeenCalledTimes(1));
    emit('INITIAL_SESSION', session);
    expect(service.ready()).toBe(false);
    resolveProfile?.({ data: profile, error: null });
    // The late event is drained by restoration, rather than racing a detached
    // profile request. Resolve that second read if it was needed.
    await vi.waitFor(() => expect(query.single).toHaveBeenCalledTimes(2));
    expect(service.ready()).toBe(false);
    resolveProfile?.({ data: profile, error: null });
    await initialization;
    expect(service.profile()?.id).toBe('user-1');
    expect(service.ready()).toBe(true);
  });

  it('does not establish a user when credentials are rejected', async () => {
    const { service, api, query } = harness();
    const failure = { code: 'invalid_credentials' };
    api.signInWithPassword.mockResolvedValue({ data: { session: null }, error: failure });
    await expect(service.login('ada@example.test', 'wrong')).rejects.toEqual(failure);
    expect(service.user()).toBeNull();
    expect(query.single).not.toHaveBeenCalled();
  });

  it('loads the user profile after a successful login', async () => {
    const { service, api } = harness();
    await service.login(' ada@example.test ', 'test-password-1234');
    expect(api.signInWithPassword).toHaveBeenCalledWith({ email: 'ada@example.test', password: 'test-password-1234' });
    expect(service.profile()?.id).toBe('user-1');
  });

  it('sends the selected role and versioned privacy consent to the signup trigger', async () => {
    const { service, api } = harness();
    expect(await service.signUp({ firstName: ' Ada ', lastName: ' Rossi ', email: ' ada@example.test ', password: 'test-password-1234', role: 'trainer' })).toBe(false);
    expect(api.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ada@example.test',
      options: expect.objectContaining({ data: {
        first_name: 'Ada', last_name: 'Rossi', role: 'trainer', privacy_accepted: true, privacy_version: 'draft-v1',
      } }),
    }));
    expect(service.user()).toBeNull();
  });

  it('routes a password recovery session to the password form outside the auth callback lock', async () => {
    const { service, emit, router } = harness();
    await service.initialize();
    emit('PASSWORD_RECOVERY', session);
    expect(service.passwordRecovery()).toBe(true);
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/auth/update-password'));
  });

  it('clears local user and profile on logout', async () => {
    const { service, api } = harness();
    await service.login('ada@example.test', 'test-password-1234');
    await service.logout();
    expect(api.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(service.user()).toBeNull();
    expect(service.profile()).toBeNull();
  });
});

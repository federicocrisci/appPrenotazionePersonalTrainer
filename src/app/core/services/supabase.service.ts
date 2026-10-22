import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { ConfigurationError } from '../../shared/utils/errors';

export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const signal = init?.signal;
  const abort = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = Boolean(environment.supabaseUrl && environment.supabaseAnonKey);
  private instance?: SupabaseClient;

  get client(): SupabaseClient {
    if (!this.configured) throw new ConfigurationError();
    this.instance ??= createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      global: { fetch: fetchWithTimeout },
    });
    return this.instance;
  }
}

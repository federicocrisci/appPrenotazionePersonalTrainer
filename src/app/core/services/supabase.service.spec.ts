import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from './supabase.service';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Supabase request timeout', () => {
  it('aborts stalled API requests after 15 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })));
    const result = fetchWithTimeout('https://example.test');
    const assertion = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it('preserves cancellation from the caller and clears the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })));
    const controller = new AbortController();
    const result = fetchWithTimeout('https://example.test', { signal: controller.signal });
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

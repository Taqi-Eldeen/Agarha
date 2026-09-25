'use client';
import { ApiRequestError } from '@agarha/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Admin endpoints are internal; a thin fetch wrapper with the admin session cookie is enough. */
export async function adminFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API}/v1${path}`, {
    ...rest,
    credentials: 'include',
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${API}/v1/auth/admin/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) return adminFetch<T>(path, init);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; requestId?: string; details?: unknown };
    throw new ApiRequestError(res.status, body.code ?? 'internal_error', body.message ?? res.statusText, body.requestId ?? '', body.details);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export function useAdminQuery<T>(key: unknown[], path: string, enabled = true) {
  return useQuery({ queryKey: key, enabled, queryFn: () => adminFetch<T>(path) });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (key: unknown[]) => qc.invalidateQueries({ queryKey: key });
}

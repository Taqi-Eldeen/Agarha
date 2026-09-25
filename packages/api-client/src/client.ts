import openapiFetch, { type Middleware } from 'openapi-fetch';
import type { paths } from './openapi';

export type ApiPaths = paths;

// In the CommonJS build (Jest, Node require) esbuild's node-mode interop hands us the module object,
// whose `default` is the function; the ESM build gets the function directly.
const createClient = ((openapiFetch as unknown as { default?: typeof openapiFetch }).default ?? openapiFetch) as typeof openapiFetch;
export type SessionScope = 'customer' | 'dealer' | 'admin';

/** Where mobile keeps its tokens (SecureStore). Web leaves this undefined and relies on httpOnly cookies. */
export interface TokenStore {
  get(): Promise<{ accessToken: string; refreshToken: string } | null>;
  set(tokens: { accessToken: string; refreshToken: string } | null): Promise<void>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  status: number;
}

export class ApiRequestError extends Error implements ApiError {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ClientOptions {
  baseUrl: string;
  locale?: () => 'ar' | 'en';
  /** Mobile: bearer tokens from SecureStore. Web: omit (cookies). */
  tokens?: TokenStore;
  scope?: SessionScope;
  fetch?: typeof fetch;
  onSessionExpired?: () => void;
}

const REFRESH_PATH: Record<SessionScope, string> = {
  customer: '/v1/auth/refresh',
  dealer: '/v1/auth/dealer/refresh',
  admin: '/v1/auth/admin/refresh',
};

/**
 * One client for web and mobile.
 * - Adds Accept-Language, Authorization (mobile) and credentials: 'include' (web cookies).
 * - On 401 it refreshes once (single-flight) and retries the request.
 * - Errors become ApiRequestError with the API's { code, message, details, requestId }.
 */
export function createApiClient(opts: ClientOptions) {
  const scope = opts.scope ?? 'customer';
  const baseFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  let refreshing: Promise<boolean> | null = null;

  async function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const stored = await opts.tokens?.get();
        const res = await baseFetch(`${opts.baseUrl}${REFRESH_PATH[scope]}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(stored ? { refreshToken: stored.refreshToken, client: 'mobile' } : { client: 'web' }),
        });
        if (!res.ok) {
          await opts.tokens?.set(null);
          opts.onSessionExpired?.();
          return false;
        }
        const body = (await res.json()) as { tokens?: { accessToken: string; refreshToken: string } };
        if (body.tokens) await opts.tokens?.set({ accessToken: body.tokens.accessToken, refreshToken: body.tokens.refreshToken });
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
    return refreshing;
  }

  const authFetch: typeof fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const attempt = async () => {
      const r = req.clone();
      const stored = await opts.tokens?.get();
      if (stored) r.headers.set('authorization', `Bearer ${stored.accessToken}`);
      return baseFetch(r);
    };
    let res = await attempt();
    const isAuthCall = new URL(req.url).pathname.startsWith('/v1/auth/');
    if (res.status === 401 && !isAuthCall && (await refresh())) res = await attempt();
    return res;
  };

  const client = createClient<paths>({ baseUrl: opts.baseUrl, fetch: authFetch, credentials: 'include' });

  const headers: Middleware = {
    onRequest({ request }) {
      request.headers.set('accept-language', opts.locale?.() ?? 'ar');
      return request;
    },
    async onResponse({ response }) {
      if (response.ok) return response;
      let body: Partial<ApiError> = {};
      try {
        body = (await response.clone().json()) as Partial<ApiError>;
      } catch {
        /* non-JSON error */
      }
      throw new ApiRequestError(response.status, body.code ?? 'internal_error', body.message ?? response.statusText, body.requestId ?? '', body.details);
    },
  };
  client.use(headers);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Idempotency key for create calls (leads, listings, uploads): retries reuse the same key. */
export function idempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Uploads a file to a presigned URL with the exact signed Content-Type. Reports progress where XHR exists. */
export function uploadToPresigned(url: string, file: Blob, contentType: string, onProgress?: (fraction: number) => void): Promise<void> {
  if (typeof XMLHttpRequest === 'undefined') {
    return fetch(url, { method: 'PUT', body: file, headers: { 'content-type': contentType } }).then((r) => {
      if (!r.ok) throw new ApiRequestError(r.status, 'upload_failed', 'Upload failed', '');
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new ApiRequestError(xhr.status, 'upload_failed', 'Upload failed', '')));
    xhr.onerror = () => reject(new ApiRequestError(0, 'network_error', 'Network error', ''));
    xhr.send(file);
  });
}

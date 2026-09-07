import { invalidateToken } from './auth/index.js';
import { fetchWithTimeout } from './http.js';

const DEFAULT_API_URL = process.env.API_URL ?? 'https://api.ferrlabs.com';

/**
 * Hosts a FerrLabs credential may be sent to.
 *
 * Every base URL in this repo comes from an environment variable, so without
 * a check a typo or a half-controlled variable forwards the token to whatever
 * host it names. Extend with `FERRLABS_MCP_ALLOWED_API_HOSTS` (comma
 * separated) for a self-hosted deployment.
 */
const DEFAULT_ALLOWED_API_HOSTS = [
  'api.ferrlabs.com',
  'api.ferrvault.com',
  'api.ferrtrack.com',
  'api.ferrgrowth.com',
  'api.ferrfleet.com',
  'api.ferrlens.com',
];

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1'];

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  /**
   * Override the API base URL for this call. Sub-MCPs targeting per-product
   * APIs (e.g. `api.ferrgrowth.com`, `api.ferrfleet.com`) set this on each
   * tool call. Falls back to `API_URL` env var, then `api.ferrlabs.com`.
   */
  baseUrl?: string;
  /**
   * Extra headers merged into the request, after the defaults and before the
   * credential headers. Product APIs that negotiate a contract version use
   * this to send their own header, e.g. `x-ferrfleet-api-version`.
   */
  headers?: Record<string, string>;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class UntrustedApiHostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UntrustedApiHostError';
  }
}

function allowedApiHosts(): string[] {
  const extra = (process.env.FERRLABS_MCP_ALLOWED_API_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
  return [...DEFAULT_ALLOWED_API_HOSTS, ...extra];
}

/**
 * Refuse to attach a credential to a request leaving for an unexpected host,
 * or travelling in clear off the loopback interface.
 *
 * @throws {UntrustedApiHostError}
 */
export function assertCredentialTarget(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UntrustedApiHostError(`refusing to send a token to a malformed URL: ${url}`);
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const loopback = LOOPBACK_HOSTS.includes(host);

  if (!loopback && parsed.protocol !== 'https:') {
    throw new UntrustedApiHostError(
      `refusing to send a token in clear over ${parsed.protocol}// to ${host}`,
    );
  }

  if (!loopback && !allowedApiHosts().includes(host)) {
    throw new UntrustedApiHostError(
      `refusing to send a token to ${host}, which is not an allowed FerrLabs API host. Set FERRLABS_MCP_ALLOWED_API_HOSTS to permit it.`,
    );
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, baseUrl, headers: extraHeaders } = options;
  const base = baseUrl ?? DEFAULT_API_URL;
  const url = `${base}${path}`;

  if (token) assertCredentialTarget(url);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ferrlabs-mcp/4.0.0',
  };

  for (const [name, value] of Object.entries(extraHeaders ?? {})) {
    headers[name] = value;
  }

  if (token) {
    headers['x-api-token'] = token;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Redirects are followed with the credential headers still attached, so a
    // 3xx off an API host walks the token to wherever Location points. No
    // route in these APIs redirects, so treat one as the anomaly it is.
    redirect: 'manual',
  });

  if (res.status >= 300 && res.status < 400) {
    throw new UntrustedApiHostError(
      `refusing to follow a redirect (HTTP ${res.status}) returned by ${url}`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (res.status === 401 && token) {
    const cleared = await invalidateToken(token);
    throw new UnauthorizedError(
      cleared
        ? 'Stored token rejected by the FerrLabs API (likely revoked or expired). The stored token has been cleared — retry the call to trigger a fresh OAuth login.'
        : 'Token rejected by the FerrLabs API. It was not read from the token file, so nothing was cleared: check the token you supplied.',
    );
  }

  const raw = await res.text();
  let data: unknown = undefined;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`API non-JSON response (HTTP ${res.status}): ${raw.slice(0, 200)}`);
    }
  }

  if (!res.ok) {
    const errMsg =
      (data as { error?: string; message?: string } | undefined)?.error ??
      (data as { error?: string; message?: string } | undefined)?.message ??
      `API error: HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

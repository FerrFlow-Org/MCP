import { clearPersistedToken, readPersistedToken, writePersistedToken } from './persistence.js';
import { runLoopbackOauthFlow } from './oauth.js';
import { getRequestBearerToken } from './context.js';

type TokenSource = 'env' | 'file' | 'oauth';

let cached: string | null = null;
let cachedSource: TokenSource | null = null;
let inFlight: Promise<string> | null = null;

export async function getToken(): Promise<string> {
  const perRequest = getRequestBearerToken();
  if (perRequest) return perRequest;

  if (process.env.FERRLABS_MCP_MODE === 'http') {
    throw new Error('Bearer token required. Send `Authorization: Bearer fl_...` on each request.');
  }

  if (cached) return cached;

  const envToken = process.env.FERRLABS_API_TOKEN ?? process.env.FERRFLOW_API_TOKEN;
  if (envToken) {
    cached = envToken;
    cachedSource = 'env';
    return envToken;
  }

  const persisted = await readPersistedToken();
  if (persisted) {
    cached = persisted;
    cachedSource = 'file';
    return persisted;
  }

  if (process.env.FERRLABS_MCP_NO_OAUTH === '1') {
    throw new Error(
      'FERRLABS_API_TOKEN environment variable is required (FERRLABS_MCP_NO_OAUTH=1 disables the OAuth fallback).',
    );
  }

  if (!inFlight) {
    inFlight = (async () => {
      const { token } = await runLoopbackOauthFlow();
      await writePersistedToken(token);
      cached = token;
      cachedSource = 'oauth';
      return token;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function clearTokenCache(): void {
  cached = null;
  cachedSource = null;
  inFlight = null;
}

/**
 * Drop a token the API has just rejected.
 *
 * Only deletes the token file when the rejected token is the one this process
 * read from it. A token supplied through `FERRLABS_API_TOKEN`, or a bearer
 * that arrived on a single HTTP request, is not ours to delete: in HTTP mode
 * one client sending a bad bearer would otherwise wipe the server's stored
 * credential for everyone.
 *
 * Returns whether the persisted file was removed.
 */
export async function invalidateToken(token: string): Promise<boolean> {
  if (cached !== token) return false;

  const source = cachedSource;
  clearTokenCache();

  if (source === 'file' || source === 'oauth') {
    await clearPersistedToken();
    return true;
  }
  return false;
}

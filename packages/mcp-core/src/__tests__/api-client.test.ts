import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, UnauthorizedError, UntrustedApiHostError } from '../api-client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const invalidateTokenMock = vi.fn<(token: string) => Promise<boolean>>();
vi.mock('../auth/index.js', () => ({
  invalidateToken: (token: string) => invalidateTokenMock(token),
}));

function makeResponse(body: unknown, status = 200): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    invalidateTokenMock.mockReset();
    invalidateTokenMock.mockResolvedValue(true);
    delete process.env.FERRLABS_MCP_ALLOWED_API_HOSTS;
  });

  it('sends extra headers alongside the defaults', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/agents', { headers: { 'x-ferrfleet-api-version': '2026-08-04' } });
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers['x-ferrfleet-api-version']).toBe('2026-08-04');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('does not let an extra header overwrite the credential headers', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/agents', {
      token: 'real',
      headers: { Authorization: 'Bearer forged', 'x-api-token': 'forged' },
    });
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers['Authorization']).toBe('Bearer real');
    expect(init.headers['x-api-token']).toBe('real');
  });

  it('makes a GET request and returns parsed JSON', async () => {
    mockFetch.mockResolvedValue(makeResponse({ status: 'ok' }));
    const result = await apiRequest<{ status: string }>('/health');
    expect(result).toEqual({ status: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('includes x-api-token header when token is provided', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: 'user-1' }));
    await apiRequest('/auth/me', { token: 'my-secret-token' });
    const [, init] = mockFetch.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-api-token']).toBe('my-secret-token');
  });

  it('returns undefined for 204 No Content responses', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: vi.fn() } as unknown as Response);
    const result = await apiRequest('/auth/tokens/123', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('throws an error when the response is not ok', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'Not found' }, 404));
    await expect(apiRequest('/missing')).rejects.toThrow('Not found');
  });

  it('throws a generic error when response has no error field', async () => {
    mockFetch.mockResolvedValue(makeResponse({}, 500));
    await expect(apiRequest('/broken')).rejects.toThrow('API error: HTTP 500');
  });

  it('sends a JSON body for POST requests', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: 'tok-1' }));
    await apiRequest('/auth/tokens', { method: 'POST', body: { name: 'ci', scopes: ['*'] } });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ name: 'ci', scopes: ['*'] }));
  });

  it('hands the rejected token to invalidateToken on a 401', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'unauthorized' }, 401));
    await expect(apiRequest('/orgs', { token: 'stale' })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(invalidateTokenMock).toHaveBeenCalledWith('stale');
  });

  it('says nothing was cleared when the token did not come from the file', async () => {
    invalidateTokenMock.mockResolvedValue(false);
    mockFetch.mockResolvedValue(makeResponse({ error: 'unauthorized' }, 401));
    await expect(apiRequest('/orgs', { token: 'from-env' })).rejects.toThrow(
      /was not read from the token file/,
    );
  });

  it('does not invalidate anything on a 401 without a token', async () => {
    mockFetch.mockResolvedValue(makeResponse({ error: 'unauthorized' }, 401));
    await expect(apiRequest('/orgs')).rejects.toThrow('unauthorized');
    expect(invalidateTokenMock).not.toHaveBeenCalled();
  });

  it('refuses to send a token to a host outside the allowlist', async () => {
    await expect(
      apiRequest('/orgs', { token: 'secret', baseUrl: 'https://evil.example.com' }),
    ).rejects.toBeInstanceOf(UntrustedApiHostError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refuses to send a token in clear over http to a remote host', async () => {
    await expect(
      apiRequest('/orgs', { token: 'secret', baseUrl: 'http://api.ferrtrack.com' }),
    ).rejects.toThrow(/in clear/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows an unlisted host once FERRLABS_MCP_ALLOWED_API_HOSTS names it', async () => {
    process.env.FERRLABS_MCP_ALLOWED_API_HOSTS = 'api.selfhosted.example';
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/orgs', { token: 'secret', baseUrl: 'https://api.selfhosted.example' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('allows a loopback base URL over http for local development', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/orgs', { token: 'secret', baseUrl: 'http://127.0.0.1:3000' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('does not gate an unauthenticated call on the host allowlist', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/stats', { baseUrl: 'https://anything.example.com' });
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('asks fetch not to follow redirects', async () => {
    mockFetch.mockResolvedValue(makeResponse({ ok: true }));
    await apiRequest('/orgs', { token: 'secret' });
    expect(mockFetch.mock.calls[0][1].redirect).toBe('manual');
  });

  it('refuses a redirect rather than walking the credential to Location', async () => {
    mockFetch.mockResolvedValue(makeResponse(undefined, 302));
    await expect(apiRequest('/orgs', { token: 'secret' })).rejects.toBeInstanceOf(
      UntrustedApiHostError,
    );
  });
});

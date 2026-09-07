import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.FERRLABS_API_TOKEN;
    delete process.env.FERRFLOW_API_TOKEN;
    delete process.env.FERRLABS_MCP_NO_OAUTH;
    process.env.FERRLABS_MCP_NO_PERSIST = '1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns FERRLABS_API_TOKEN when set, without touching persistence or OAuth', async () => {
    process.env.FERRLABS_API_TOKEN = 'fl_env_token';
    const { getToken } = await import('../index.js');
    expect(await getToken()).toBe('fl_env_token');
  });

  it('falls back to FERRFLOW_API_TOKEN (legacy compat)', async () => {
    process.env.FERRFLOW_API_TOKEN = 'fl_legacy_token';
    const { getToken } = await import('../index.js');
    expect(await getToken()).toBe('fl_legacy_token');
  });

  it('throws when no token and FERRLABS_MCP_NO_OAUTH=1', async () => {
    process.env.FERRLABS_MCP_NO_OAUTH = '1';
    const { getToken } = await import('../index.js');
    await expect(getToken()).rejects.toThrow(/FERRLABS_API_TOKEN environment variable is required/);
  });

  it('caches the token across calls (env path)', async () => {
    process.env.FERRLABS_API_TOKEN = 'fl_cached';
    const { getToken } = await import('../index.js');
    const a = await getToken();
    process.env.FERRLABS_API_TOKEN = 'fl_changed';
    const b = await getToken();
    expect(a).toBe(b);
    expect(a).toBe('fl_cached');
  });
});

describe('invalidateToken', () => {
  const originalEnv = process.env;
  const clearPersistedTokenMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    clearPersistedTokenMock.mockReset();
    process.env = { ...originalEnv };
    delete process.env.FERRLABS_API_TOKEN;
    delete process.env.FERRFLOW_API_TOKEN;
    delete process.env.FERRLABS_MCP_MODE;
    vi.doMock('../persistence.js', () => ({
      clearPersistedToken: () => clearPersistedTokenMock(),
      readPersistedToken: () => Promise.resolve('fl_from_file'),
      writePersistedToken: () => Promise.resolve(),
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.doUnmock('../persistence.js');
  });

  it('deletes the token file when the rejected token came from it', async () => {
    const { getToken, invalidateToken } = await import('../index.js');
    const token = await getToken();
    expect(token).toBe('fl_from_file');

    await expect(invalidateToken(token)).resolves.toBe(true);
    expect(clearPersistedTokenMock).toHaveBeenCalledOnce();
  });

  it('leaves the token file alone when the rejected token came from the environment', async () => {
    process.env.FERRLABS_API_TOKEN = 'fl_from_env';
    const { getToken, invalidateToken } = await import('../index.js');
    const token = await getToken();

    await expect(invalidateToken(token)).resolves.toBe(false);
    expect(clearPersistedTokenMock).not.toHaveBeenCalled();
  });

  it('ignores a token this process never cached, so one bad bearer cannot wipe the file', async () => {
    const { getToken, invalidateToken } = await import('../index.js');
    await getToken();

    await expect(invalidateToken('someone-elses-bearer')).resolves.toBe(false);
    expect(clearPersistedTokenMock).not.toHaveBeenCalled();
  });

  it('drops the cache so the next call re-reads the source', async () => {
    const { getToken, invalidateToken } = await import('../index.js');
    const first = await getToken();
    await invalidateToken(first);

    process.env.FERRLABS_API_TOKEN = 'fl_replacement';
    expect(await getToken()).toBe('fl_replacement');
  });
});

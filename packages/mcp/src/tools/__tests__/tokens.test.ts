import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

process.env.FERRLABS_API_TOKEN = 'test-token';

const handlers = new Map<string, (params: Record<string, unknown>) => Promise<ToolResult>>();
const mockServer = {
  tool: vi.fn((name, _desc, _schema, handler) => {
    handlers.set(name, handler);
  }),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const SECRET = 'fl_live_plaintext_secret_value';

describe('create_token', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    delete process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL;
    const { registerTokenTools } = await import('../tokens.js');
    registerTokenTools(mockServer);
  });

  afterEach(() => {
    delete process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL;
  });

  it('refuses without ever calling the API, so no credential is minted', async () => {
    const result = await handlers.get('create_token')!({ name: 'ci', scopes: ['*'] });

    expect(result.isError).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('names the environment variable and the dashboard in the refusal', async () => {
    const result = await handlers.get('create_token')!({ name: 'ci', scopes: ['*'] });
    const text = result.content[0].text ?? '';

    expect(text).toMatch(/FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1/);
    expect(text).toMatch(/app\.ferrlabs\.com/);
  });

  it('returns the secret once the operator has opted in', async () => {
    process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL = '1';
    mockFetch.mockResolvedValue(
      makeResponse({
        id: 't1',
        name: 'ci',
        token_prefix: 'fl_live',
        scopes: ['*'],
        expires_at: null,
        last_used_at: null,
        created_at: '2026-09-07T00:00:00Z',
        plaintext: SECRET,
      }),
    );

    const result = await handlers.get('create_token')!({ name: 'ci', scopes: ['*'] });
    const text = result.content[0].text ?? '';

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(text).toContain(SECRET);
    expect(text).toMatch(/now in this transcript/);
  });

  it('leaks nothing on the default path', async () => {
    mockFetch.mockResolvedValue(makeResponse({ plaintext: SECRET }));
    const result = await handlers.get('create_token')!({ name: 'ci', scopes: ['*'] });

    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

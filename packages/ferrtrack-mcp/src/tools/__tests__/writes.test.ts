import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ZodTypeAny } from 'zod';
import type { McpServer } from '@ferrlabs/mcp-core';

process.env.FERRLABS_API_TOKEN = 'test-token';

type Handler = (params: Record<string, unknown>) => Promise<{ content: { text?: string }[] }>;

const handlers = new Map<string, Handler>();
const schemas = new Map<string, Record<string, ZodTypeAny>>();
const mockServer = {
  tool: vi.fn(
    (name: string, _desc: string, schema: Record<string, ZodTypeAny>, handler: Handler) => {
      handlers.set(name, handler);
      schemas.set(name, schema);
    },
  ),
} as unknown as McpServer;

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function ok(body: unknown = { id: 'x' }): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = mockFetch.mock.calls[0];
  return {
    url: String(url),
    method: init.method ?? 'GET',
    body: init.body ? JSON.parse(init.body) : undefined,
  };
}

const TRACK = 'https://api.ferrtrack.com/v1';

describe('ferrtrack write tools', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    schemas.clear();
    mockFetch.mockResolvedValue(ok());
    const { registerIssueTools } = await import('../issues.js');
    const { registerCycleTools } = await import('../cycles.js');
    const { registerCommentTools } = await import('../comments.js');
    registerIssueTools(mockServer);
    registerCycleTools(mockServer);
    registerCommentTools(mockServer);
  });

  it('every call goes to the FerrTrack API, not the unified one', async () => {
    await handlers.get('create_issue')!({ project_slug: 'web', title: 'Bug' });
    expect(lastCall().url.startsWith('https://api.ferrtrack.com')).toBe(true);
    expect(lastCall().url).not.toContain('api.ferrlabs.com');
  });

  it('create_issue posts to the project issues collection with defaults filled in', async () => {
    await handlers.get('create_issue')!({ project_slug: 'web', title: 'Bug' });

    const call = lastCall();
    expect(call.url).toBe(`${TRACK}/projects/web/issues`);
    expect(call.method).toBe('POST');
    expect(call.body).toEqual({
      title: 'Bug',
      body: '',
      kind: 'feat',
      labels: [],
      assignee_id: null,
    });
  });

  it('update_issue patches by ref and sends only what was passed', async () => {
    await handlers.get('update_issue')!({ issue_ref: 'FT-12', status: 'closed' });

    const call = lastCall();
    expect(call.url).toBe(`${TRACK}/issues/FT-12`);
    expect(call.method).toBe('PATCH');
    expect(call.body).toEqual({ status: 'closed' });
  });

  it('update_issue can clear an assignee, which is not the same as omitting it', async () => {
    await handlers.get('update_issue')!({ issue_ref: 'FT-12', assignee_id: null });
    expect(lastCall().body).toEqual({ assignee_id: null });
  });

  it('delete_cycle uses DELETE on the cycle and names it back', async () => {
    const result = await handlers.get('delete_cycle')!({ cycle_id: 'c9' });

    const call = lastCall();
    expect(call.url).toBe(`${TRACK}/cycles/c9`);
    expect(call.method).toBe('DELETE');
    expect(result.content[0].text).toContain('c9');
  });

  it('plan_next_cycle posts to the plan sub-resource rather than creating a cycle', async () => {
    await handlers.get('plan_next_cycle')!({ project_slug: 'web' });

    const call = lastCall();
    expect(call.url).toBe(`${TRACK}/projects/web/cycles/plan`);
    expect(call.method).toBe('POST');
  });

  it('escapes an issue ref so it cannot climb the path', async () => {
    await handlers.get('update_issue')!({ issue_ref: '../projects', title: 'x' });
    expect(lastCall().url).toBe(`${TRACK}/issues/..%2Fprojects`);
  });

  it('rejects an issue status outside the declared set', () => {
    const status = schemas.get('update_issue')!.status;
    expect(status.safeParse('closed').success).toBe(true);
    expect(status.safeParse('done').success).toBe(false);
  });
});

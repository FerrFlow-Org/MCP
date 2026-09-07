import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ServerUnderTest {
  /** Directory under `packages/`. */
  pkg: string;
  /** `serverInfo.name` the binary must report. */
  serverName: string;
  /** A few tools that must be advertised. Not the full list: this is a boot check. */
  expectedTools: string[];
  /**
   * Tools to actually invoke. Only the unified server has any: every sub-MCP
   * tool needs a credential and a live product API.
   */
  liveCalls?: LiveCall[];
}

interface LiveCall {
  tool: string;
  check: (parsed: unknown) => boolean;
  describe: (parsed: unknown) => string;
}

const SERVERS: ServerUnderTest[] = [
  {
    pkg: 'mcp',
    serverName: 'ferrlabs',
    expectedTools: [
      'get_stats',
      'health_check',
      'fetch_docs',
      'get_me',
      'list_tokens',
      'list_orgs',
      'list_projects',
      'list_vaults',
      'list_issues',
      'list_subscriptions',
    ],
    liveCalls: [
      {
        tool: 'health_check',
        check: (p) => isRecord(p) && (p.status === 'ready' || p.status === 'ok'),
        describe: (p) => `status=${isRecord(p) ? String(p.status) : '?'}`,
      },
      {
        tool: 'get_stats',
        check: (p) => isRecord(p) && typeof p.total_releases === 'number',
        describe: (p) => `total_releases=${isRecord(p) ? String(p.total_releases) : '?'}`,
      },
    ],
  },
  {
    pkg: 'ferrvault-mcp',
    serverName: 'ferrvault',
    expectedTools: ['get_vault', 'list_secrets', 'create_secret', 'rotate_secret', 'delete_vault'],
  },
  {
    pkg: 'ferrtrack-mcp',
    serverName: 'ferrtrack',
    expectedTools: [
      'list_issues',
      'create_issue',
      'update_issue',
      'plan_next_cycle',
      'delete_cycle',
    ],
  },
  {
    pkg: 'ferrgrowth-mcp',
    serverName: 'ferrgrowth',
    expectedTools: ['list_sites', 'create_site', 'publish_page', 'activate_release', 'delete_form'],
  },
  {
    pkg: 'ferrfleet-mcp',
    serverName: 'ferrfleet',
    expectedTools: ['list_agents', 'get_agent', 'trigger_agent_run', 'list_runs', 'get_run'],
  },
];

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ContentBlock {
  type: string;
  text?: string;
}

interface ToolResult {
  content?: ContentBlock[];
  isError?: boolean;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

const TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * One server subprocess speaking JSON-RPC over stdio.
 */
class McpClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, (msg: JsonRpcResponse) => void>();
  private nextId = 1;
  private buffer = '';

  constructor(entry: string) {
    this.child = spawn(process.execPath, [entry], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onData(chunk));
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line);
      } catch {
        console.error(`  non-JSON line from server: ${line.slice(0, 120)}`);
        continue;
      }
      const cb = this.pending.get(msg.id);
      if (cb) {
        this.pending.delete(msg.id);
        cb(msg);
      }
    }
  }

  rpc<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolveP, rejectP) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectP(new Error(`timed out waiting for ${method}`));
      }, TIMEOUT_MS);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) {
          rejectP(new Error(`${method} failed: ${msg.error.message}`));
          return;
        }
        resolveP(msg.result as T);
      });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  notify(method: string): void {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  }

  dispose(): void {
    this.child.stdin.end();
    this.child.kill();
  }
}

async function checkServer(server: ServerUnderTest): Promise<Check[]> {
  const checks: Check[] = [];
  const entry = resolve(__dirname, '..', 'packages', server.pkg, 'dist', 'index.js');

  if (!existsSync(entry)) {
    return [
      {
        name: `${server.serverName}: dist present`,
        ok: false,
        detail: `${entry} missing — run 'pnpm build' first`,
      },
    ];
  }

  const client = new McpClient(entry);
  try {
    const init = await client.rpc<{ serverInfo: { name: string; version: string } }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ferrlabs-mcp-smoke', version: '1.0.0' },
    });
    checks.push({
      name: `${server.serverName}: initialize`,
      ok: init.serverInfo.name === server.serverName,
      detail: `serverInfo: ${init.serverInfo.name}@${init.serverInfo.version}`,
    });

    client.notify('notifications/initialized');

    const list = await client.rpc<{ tools: { name: string }[] }>('tools/list');
    const names = new Set(list.tools.map((t) => t.name));
    const missing = server.expectedTools.filter((n) => !names.has(n));
    checks.push({
      name: `${server.serverName}: tools/list`,
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${list.tools.length} tools registered`
          : `missing: ${missing.join(', ')}`,
    });

    for (const call of server.liveCalls ?? []) {
      const result = await client.rpc<ToolResult>('tools/call', {
        name: call.tool,
        arguments: {},
      });
      const text = result.content?.[0]?.text ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      const ok = !result.isError && call.check(parsed);
      checks.push({
        name: `${server.serverName}: tools/call ${call.tool}`,
        ok,
        detail: ok ? call.describe(parsed) : `unexpected response: ${text.slice(0, 120)}`,
      });
    }
  } catch (err) {
    checks.push({
      name: `${server.serverName}: boot`,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client.dispose();
  }

  return checks;
}

async function run(): Promise<number> {
  const checks: Check[] = [];
  for (const server of SERVERS) {
    // eslint-disable-next-line no-await-in-loop -- one subprocess at a time keeps the output readable
    checks.push(...(await checkServer(server)));
  }

  let failed = 0;
  for (const c of checks) {
    console.log(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.name} — ${c.detail}`);
    if (!c.ok) failed++;
  }
  console.log('');
  if (failed === 0) {
    console.log(`Smoke: ${checks.length}/${checks.length} OK across ${SERVERS.length} servers`);
    return 0;
  }
  console.error(`Smoke: ${failed}/${checks.length} FAILED`);
  return 1;
}

run()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Smoke aborted:', err instanceof Error ? err.message : err);
    process.exit(1);
  });

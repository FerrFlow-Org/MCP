import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runWithAuthContext } from '../auth/context.js';

const MAX_BODY_BYTES = 1_000_000;

function extractBearer(req: IncomingMessage): string | undefined {
  const header = req.headers['authorization'];
  if (typeof header !== 'string') return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1];
}

export function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function resolveAllowedOrigin(
  requestOrigin: string | undefined,
  allowlist: string[],
): string | undefined {
  if (requestOrigin === undefined) return undefined;
  return allowlist.includes(requestOrigin) ? requestOrigin : undefined;
}

export function isHostAllowed(hostHeader: string | undefined, allowedHosts: string[]): boolean {
  if (allowedHosts.length === 0) return true;
  if (!hostHeader) return false;
  const host = hostHeader.split(':')[0].toLowerCase();
  return allowedHosts.some((allowed) => allowed.split(':')[0].toLowerCase() === host);
}

export function defaultBindHost(envHost: string | undefined, bindAll: boolean): string {
  if (envHost) return envHost;
  return bindAll ? '0.0.0.0' : '127.0.0.1';
}

function publicOrigin(req: IncomingMessage): string {
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
  return `${proto}://${host}`;
}

const UNAUTHORIZED_DESCRIPTION =
  'Missing or invalid bearer token. Fetch the OAuth protected-resource metadata and run the authorization code + PKCE flow.';

export function unauthorizedChallenge(metadataUrl: string): {
  wwwAuthenticate: string;
  body: string;
} {
  return {
    wwwAuthenticate: `Bearer error="invalid_token", error_description="${UNAUTHORIZED_DESCRIPTION}", resource_metadata="${metadataUrl}"`,
    body: JSON.stringify({
      error: 'invalid_token',
      error_description: UNAUTHORIZED_DESCRIPTION,
    }),
  };
}

export interface HttpServerOptions {
  port: number;
  host?: string;
  stateless?: boolean;
  createServer: () => McpServer;
  /**
   * URL of the OAuth 2.0 Authorization Server users authenticate against.
   * Surfaced to MCP clients via /.well-known/oauth-protected-resource so
   * they can drive the standard PKCE flow when no Bearer is present.
   *
   * Must be the host that serves the OIDC / OAuth 2.0 discovery metadata
   * (i.e. `<host>/.well-known/openid-configuration` or
   * `<host>/.well-known/oauth-authorization-server`). For FerrLabs that's
   * `api.ferrlabs.com` — `auth.ferrlabs.com` is the user-facing login SPA
   * but doesn't serve the metadata documents.
   *
   * Defaults to `FERRLABS_AUTH_URL` env or `https://api.ferrlabs.com`.
   */
  authorizationServer?: string;
}

class PayloadTooLargeError extends Error {
  constructor() {
    super(`Request body exceeds the ${MAX_BODY_BYTES}-byte limit`);
    this.name = 'PayloadTooLargeError';
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown | undefined> {
  if (req.method !== 'POST') return undefined;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function startHttpServer(opts: HttpServerOptions): Promise<void> {
  const { port, stateless = true } = opts;
  const bindAll = process.env.FERRLABS_MCP_BIND_ALL === '1';
  const host = defaultBindHost(opts.host, bindAll);
  const allowedOrigins = parseList(process.env.FERRLABS_MCP_ALLOWED_ORIGINS);
  const allowedHosts = parseList(process.env.FERRLABS_MCP_ALLOWED_HOSTS);
  const authServer =
    opts.authorizationServer ?? process.env.FERRLABS_AUTH_URL ?? 'https://api.ferrlabs.com';
  const transports = new Map<string, StreamableHTTPServerTransport>();

  function sendUnauthorized(req: IncomingMessage, res: ServerResponse): void {
    const origin = publicOrigin(req);
    const { wwwAuthenticate, body } = unauthorizedChallenge(
      `${origin}/.well-known/oauth-protected-resource`,
    );
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthenticate,
    });
    res.end(body);
  }

  function sendResourceMetadata(req: IncomingMessage, res: ServerResponse): void {
    const origin = publicOrigin(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        resource: origin,
        authorization_servers: [authServer],
        bearer_methods_supported: ['header'],
        resource_documentation: 'https://ferrlabs.com',
      }),
    );
  }

  async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const bearerToken = extractBearer(req);
    if (!bearerToken) {
      sendUnauthorized(req, res);
      return;
    }

    const sessionId = (req.headers['mcp-session-id'] as string | undefined) ?? undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (sessionId && !transport && !stateless) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: `Session ${sessionId} not found — reinitialize to obtain a new session`,
          },
          id: null,
        }),
      );
      return;
    }

    // In stateless mode nothing ever retains what we build here, so the pair
    // has to be torn down once the response is written. Left alone, every
    // request adds an McpServer and a transport that live until the process
    // does.
    let disposable: { server: McpServer; transport: StreamableHTTPServerTransport } | undefined;

    if (!transport) {
      let createdSessionId: string | undefined;
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: stateless ? undefined : randomUUID,
        onsessioninitialized: stateless
          ? undefined
          : (newSessionId: string) => {
              createdSessionId = newSessionId;
              if (transport) transports.set(newSessionId, transport);
            },
      });
      transport.onclose = () => {
        if (createdSessionId) transports.delete(createdSessionId);
      };
      const server = opts.createServer();
      await server.connect(transport);
      if (stateless) disposable = { server, transport };
    }

    const body = await readJsonBody(req);
    try {
      await runWithAuthContext({ bearerToken }, () => transport.handleRequest(req, res, body));
    } finally {
      if (disposable) {
        await disposable.transport.close().catch(() => undefined);
        await disposable.server.close().catch(() => undefined);
      }
    }
  }

  function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
    res.setHeader('Vary', 'Origin');
    const allowed = resolveAllowedOrigin(req.headers.origin as string | undefined, allowedOrigins);
    if (!allowed) return;
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'authorization, content-type, mcp-session-id, mcp-protocol-version',
    );
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id, www-authenticate');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  const httpServer = createHttpServer((req, res) => {
    applyCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (!isHostAllowed(req.headers.host, allowedHosts)) {
      res.writeHead(421, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Host not allowed' }));
      return;
    }

    const url = req.url ?? '/';
    if (url === '/health' || url === '/livez' || url === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'ferrlabs-mcp' }));
      return;
    }
    if (url === '/.well-known/oauth-protected-resource') {
      sendResourceMetadata(req, res);
      return;
    }
    if (url === '/mcp' || url.startsWith('/mcp?')) {
      handleMcpRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          const status = err instanceof PayloadTooLargeError ? 413 : 500;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          res.end();
        }
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => {
      console.error(`ferrlabs-mcp HTTP transport listening on http://${host}:${port}/mcp`);
      resolve();
    });
  });
}

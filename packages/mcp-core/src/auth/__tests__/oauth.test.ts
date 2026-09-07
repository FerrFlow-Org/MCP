import { describe, it, expect } from 'vitest';
import { generatePkcePair, __testOnly } from '../oauth.js';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';

describe('generatePkcePair', () => {
  it('returns a verifier between 43 and 128 chars (RFC 7636)', () => {
    const { verifier } = generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('returns a challenge that is SHA-256(verifier) base64url-encoded', () => {
    const { verifier, challenge } = generatePkcePair();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    expect(challenge).toBe(expected);
  });

  it('returns different verifier+challenge pairs each call', () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it('returns base64url-encoded values (no +, /, =)', () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()));
  const addr = probe.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  await closeServer(probe);
  return port;
}

describe('bindCallbackListener (port fallback)', () => {
  it('rejects synchronously with EADDRINUSE when the port is already bound', async () => {
    const port = await freePort();
    const squatter = createServer();
    await new Promise<void>((resolve) => squatter.listen(port, '127.0.0.1', () => resolve()));

    try {
      await expect(__testOnly.bindCallbackListener(port, 'st')).rejects.toThrow(/EADDRINUSE/);
    } finally {
      await closeServer(squatter);
    }
  });

  it('resolves with the bound port when the socket is free', async () => {
    const port = await freePort();
    const bound = await __testOnly.bindCallbackListener(port, 'st');
    expect(bound.port).toBe(port);
    // Attach a catch handler *before* triggering the rejection so the
    // unhandled-rejection guard in vitest stays quiet.
    const callbackSettled = bound.callback.catch((err: Error) => err);
    const res = await fetch(`http://127.0.0.1:${port}/cb?code=x&state=wrong`);
    expect(res.status).toBe(400);
    const settled = await callbackSettled;
    expect(settled).toBeInstanceOf(Error);
    expect((settled as Error).message).toMatch(/state mismatch/);
  });
});

describe('bindCallbackListener (port release)', () => {
  it('frees the port on close, so a later flow can bind it again', async () => {
    const port = await freePort();

    const first = await __testOnly.bindCallbackListener(port, 'st');
    first.callback.catch(() => undefined);
    expect(first.port).toBe(port);

    first.close();

    // Rebinding the same port is the only honest proof it was released:
    // an unclosed listener makes this throw EADDRINUSE, which is the bug
    // the flow's own error message told users to clear by hand.
    const second = await __testOnly.bindCallbackListener(port, 'st');
    second.callback.catch(() => undefined);
    expect(second.port).toBe(port);
    second.close();
  });

  it('tolerates close being called twice', async () => {
    const port = await freePort();
    const bound = await __testOnly.bindCallbackListener(port, 'st');
    bound.callback.catch(() => undefined);

    bound.close();
    expect(() => bound.close()).not.toThrow();
  });

  it('releases the port after it has actually served a connection', async () => {
    const { Agent, request } = await import('node:http');
    const port = await freePort();
    const bound = await __testOnly.bindCallbackListener(port, 'st');
    bound.callback.catch(() => undefined);

    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    await new Promise<void>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path: '/nope', agent }, (res) => {
        res.resume();
        res.on('end', () => resolve());
      });
      req.on('error', reject);
      req.end();
    });

    bound.close();

    const again = await __testOnly.bindCallbackListener(port, 'st');
    again.callback.catch(() => undefined);
    expect(again.port).toBe(port);
    again.close();
    agent.destroy();
  });
});

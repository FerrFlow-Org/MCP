import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toToolText, maxToolBytes } from '../tool-text.js';

describe('toToolText', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FERRLABS_MCP_MAX_TOOL_BYTES;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('serialises compactly, without the indentation that doubled the cost', () => {
    const text = toToolText({ a: 1, b: [2, 3] });
    expect(text).toBe('{"a":1,"b":[2,3]}');
    expect(text).not.toContain('\n');
  });

  it('passes a payload under the ceiling through untouched', () => {
    const value = { items: ['a', 'b'] };
    expect(toToolText(value)).toBe(JSON.stringify(value));
  });

  it('caps a payload over the ceiling and marks it as incomplete', () => {
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = '200';
    const text = toToolText({ blob: 'x'.repeat(5000) });

    expect(Buffer.byteLength(text, 'utf8')).toBeLessThan(1000);
    expect(text).toMatch(/\[truncated: \d+ of \d+ bytes dropped/);
    expect(text).toMatch(/must not be read as the whole result/);
  });

  it('names the argument that would narrow the result', () => {
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = '100';
    const text = toToolText({ rows: 'y'.repeat(2000) }, { narrowWith: 'Pass a smaller limit.' });

    expect(text).toContain('Pass a smaller limit.');
  });

  it('keeps the start of the payload so the shape stays readable', () => {
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = '60';
    const text = toToolText({ id: 'run-1', events: 'z'.repeat(500) });

    expect(text.startsWith('{"id":"run-1"')).toBe(true);
  });

  it('does not cut a multi-byte character into an invalid sequence', () => {
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = '25';
    const text = toToolText({ n: 'é'.repeat(200) });

    // A naive slice on the byte buffer lands mid-sequence and yields U+FFFD.
    expect(text.slice(0, 25)).not.toContain('\uFFFD');
  });

  it('falls back to the default ceiling when the env var is not a positive number', () => {
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = 'nonsense';
    expect(maxToolBytes()).toBe(100_000);
    process.env.FERRLABS_MCP_MAX_TOOL_BYTES = '-5';
    expect(maxToolBytes()).toBe(100_000);
  });

  it('returns a string payload as-is rather than quoting it', () => {
    expect(toToolText('already text')).toBe('already text');
  });
});

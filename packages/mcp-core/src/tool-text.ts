const DEFAULT_MAX_TOOL_BYTES = 100_000;

export function maxToolBytes(): number {
  const raw = process.env.FERRLABS_MCP_MAX_TOOL_BYTES;
  if (!raw) return DEFAULT_MAX_TOOL_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOOL_BYTES;
}

interface ToolTextOptions {
  /**
   * What the caller can change to get less back, e.g. "pass a smaller
   * `limit`". Appended to the truncation notice so the assistant can recover
   * on its own instead of retrying the same call.
   */
  narrowWith?: string;
}

/**
 * Serialise a tool payload for the model, with a ceiling.
 *
 * Compact rather than pretty-printed: indentation roughly doubles the token
 * cost and a model reader gains nothing from it.
 *
 * Truncation is announced in the returned text. Silently cutting a payload is
 * worse than sending too much, because the assistant then reasons over a
 * fragment it believes is complete.
 */
/**
 * Cut to at most `maxBytes`, stepping back off a UTF-8 continuation byte so
 * the last character is never left half-decoded as U+FFFD.
 */
function sliceUtf8(input: string, maxBytes: number): string {
  const buf = Buffer.from(input, 'utf8');
  if (buf.length <= maxBytes) return input;

  let end = maxBytes;
  while (end > 0 && (buf[end] & 0b1100_0000) === 0b1000_0000) end--;
  return buf.subarray(0, end).toString('utf8');
}

export function toToolText(value: unknown, options: ToolTextOptions = {}): string {
  const serialised = typeof value === 'string' ? value : JSON.stringify(value);

  if (serialised === undefined) return 'null';

  const budget = maxToolBytes();
  const total = Buffer.byteLength(serialised, 'utf8');
  if (total <= budget) return serialised;

  const kept = sliceUtf8(serialised, budget);
  const dropped = total - Buffer.byteLength(kept, 'utf8');
  const narrow = options.narrowWith ? ` ${options.narrowWith}` : '';

  return (
    `${kept}\n\n[truncated: ${dropped} of ${total} bytes dropped, ` +
    `so this payload is incomplete and must not be read as the whole result.${narrow} ` +
    `Raise FERRLABS_MCP_MAX_TOOL_BYTES to change the ${budget}-byte ceiling.]`
  );
}

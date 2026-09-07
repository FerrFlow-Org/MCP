import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, getToken, toToolText } from '@ferrlabs/mcp-core';

interface MeProfile {
  id: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  locale: string;
  preferences: Record<string, unknown>;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
}

interface MeSession {
  id: string;
  client_id: string;
  user_agent: string | null;
  ip: string | null;
  last_active_at: string;
  expires_at: string;
  created_at: string;
  current: boolean;
}

export function registerMeTools(server: McpServer) {
  server.tool(
    'update_me',
    "Patch the authenticated user's own profile — display name, timezone, locale, avatar URL. Email + password rotate via dedicated flows in the UI, not here.",
    {
      display_name: z.string().min(1).max(100).optional(),
      timezone: z.string().min(1).max(64).optional().describe("IANA tz, e.g. 'Europe/Paris'."),
      locale: z
        .string()
        .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
        .optional()
        .describe("BCP 47, e.g. 'en' or 'fr-FR'."),
      avatar_url: z.string().url().nullable().optional(),
    },
    async (patch) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const me = await apiRequest<MeProfile>('/auth/me', {
        token,
        method: 'PATCH',
        body,
      });
      return { content: [{ type: 'text' as const, text: toToolText(me) }] };
    },
  );

  server.tool(
    'list_my_sessions',
    'List your active sessions across devices/browsers. The session you used to obtain the current token is flagged `current: true`.',
    {},
    async () => {
      const token = await getToken();
      const sessions = await apiRequest<MeSession[]>('/me/sessions', { token });
      return { content: [{ type: 'text' as const, text: toToolText(sessions) }] };
    },
  );

  server.tool(
    'revoke_my_session',
    'Revoke one of your active sessions by id (sign out that device). Refusing to revoke the current session is left up to the API.',
    {
      session_id: z.string().min(1).describe('Session id (from list_my_sessions)'),
    },
    async ({ session_id }) => {
      const token = await getToken();
      await apiRequest<void>(`/me/sessions/${encodeURIComponent(session_id)}`, {
        token,
        method: 'DELETE',
      });
      return { content: [{ type: 'text' as const, text: `Session ${session_id} revoked.` }] };
    },
  );

  server.tool(
    'export_my_account',
    "Trigger an export of the authenticated user's data (GDPR Article 15). Returns the export bundle, which can be large; consider redirecting the LLM context to a summary.",
    {},
    async () => {
      const token = await getToken();
      const dump = await apiRequest<unknown>('/auth/me/export', { token });
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(dump, {
              narrowWith: 'Export the account from app.ferrlabs.com to get the bundle whole.',
            }),
          },
        ],
      };
    },
  );
}

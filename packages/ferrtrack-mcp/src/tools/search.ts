import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface SearchHit {
  kind: 'issue' | 'project';
  ref: string | null;
  slug: string | null;
  title: string;
  snippet: string | null;
  score: number;
}

interface TrackUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function registerSearchTools(server: McpServer) {
  server.tool(
    'search_track',
    "Full-text + trigram search across FerrTrack issues and projects in the caller's org. Returns ranked hits.",
    {
      q: z.string().min(1).describe('Search query.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max hits to return (default 25).'),
    },
    async ({ q, limit }) => {
      const token = await getToken();
      const params = new URLSearchParams({ q });
      if (limit !== undefined) params.set('limit', String(limit));
      const hits = await apiRequest<SearchHit[]>(`/v1/search?${params.toString()}`, {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(hits) }],
      };
    },
  );

  server.tool(
    'list_track_users',
    "List FerrTrack users in the caller's org — useful for resolving an `assignee_id` before calling create_issue or update_issue.",
    {},
    async () => {
      const token = await getToken();
      const users = await apiRequest<TrackUser[]>('/v1/users', {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(users) }],
      };
    },
  );
}

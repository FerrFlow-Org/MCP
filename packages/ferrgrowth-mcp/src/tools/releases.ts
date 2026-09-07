import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface Release {
  id: string;
  site_id: string;
  version: string;
  active: boolean;
  size_bytes: number;
  created_at: string;
}

export function registerReleaseTools(server: McpServer) {
  server.tool(
    'get_release',
    'Get details of a single FerrGrowth release (build metadata, size, active flag).',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      release_id: z.string().min(1).describe('Release id'),
    },
    async ({ site_id, release_id }) => {
      const token = await getToken();
      const release = await apiRequest<Release>(
        `/v1/sites/${encodeURIComponent(site_id)}/releases/${encodeURIComponent(release_id)}`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(release) }],
      };
    },
  );

  server.tool(
    'list_releases',
    'List bundle releases of a FerrGrowth site (built artefacts). The one with `active: true` is the one currently served.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const releases = await apiRequest<Release[]>(
        `/v1/sites/${encodeURIComponent(site_id)}/releases`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(releases) }],
      };
    },
  );

  server.tool(
    'activate_release',
    'Switch the live serving release for a FerrGrowth site to a specific release id (rollback or roll-forward). Atomic — no downtime.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      release_id: z.string().min(1).describe('Release id'),
    },
    async ({ site_id, release_id }) => {
      const token = await getToken();
      const release = await apiRequest<Release>(
        `/v1/sites/${encodeURIComponent(site_id)}/releases/${encodeURIComponent(release_id)}/activate`,
        { token, baseUrl: GROWTH_API_URL, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(release) }],
      };
    },
  );
}

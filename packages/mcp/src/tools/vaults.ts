import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, toToolText } from '@ferrlabs/mcp-core';
import { getToken } from '@ferrlabs/mcp-core';

interface VaultWithStats {
  id: string;
  name: string;
  description: string | null;
  secret_count: number;
  created_at: string;
  updated_at: string;
}

export function registerVaultsTools(server: McpServer) {
  server.tool(
    'list_vaults',
    'List FerrVault vaults inside a project (FerrVault — secrets management)',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      project_slug: z.string().min(1).describe('Project slug'),
    },
    async ({ org_slug, project_slug }) => {
      const token = await getToken();
      const vaults = await apiRequest<VaultWithStats[]>(
        `/orgs/${encodeURIComponent(org_slug)}/projects/${encodeURIComponent(project_slug)}/vaults`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(vaults) }],
      };
    },
  );
}

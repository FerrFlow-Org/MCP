import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';

interface VaultDetails {
  id: string;
  name: string;
  description: string | null;
  secret_count: number;
  created_at: string;
  updated_at: string;
}

export function registerVaultDetailsTool(server: McpServer) {
  server.tool(
    'get_vault',
    'Get detailed information about a single FerrVault vault — name, description, secret count, timestamps.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      project_slug: z.string().min(1).describe('Project slug'),
      vault_id: z.string().min(1).describe('Vault id'),
    },
    async ({ org_slug, project_slug, vault_id }) => {
      const token = await getToken();
      const vault = await apiRequest<VaultDetails>(
        `/orgs/${encodeURIComponent(org_slug)}/projects/${encodeURIComponent(project_slug)}/vaults/${encodeURIComponent(vault_id)}`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(vault) }],
      };
    },
  );
}

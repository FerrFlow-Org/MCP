import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, toToolText } from '@ferrlabs/mcp-core';
import { getToken } from '@ferrlabs/mcp-core';

interface OrgWithMemberCount {
  id: string;
  slug: string;
  name: string;
  member_count: number;
  created_at: string;
}

interface ProjectWithCounts {
  id: string;
  slug: string;
  name: string;
  issue_count: number;
  vault_count: number;
  created_at: string;
}

export function registerOrgsTools(server: McpServer) {
  server.tool(
    'list_orgs',
    'List FerrLabs organizations the authenticated user belongs to',
    {},
    async () => {
      const token = await getToken();
      const orgs = await apiRequest<OrgWithMemberCount[]>('/orgs', { token });
      return {
        content: [{ type: 'text' as const, text: toToolText(orgs) }],
      };
    },
  );

  server.tool(
    'list_projects',
    'List projects inside a FerrLabs organization',
    {
      org_slug: z.string().min(1).describe('Organization slug (from list_orgs)'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const projects = await apiRequest<ProjectWithCounts[]>(
        `/orgs/${encodeURIComponent(org_slug)}/projects`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(projects) }],
      };
    },
  );
}

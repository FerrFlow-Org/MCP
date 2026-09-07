import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface IssueDetails {
  id: string;
  ref: string;
  project_id: string;
  title: string;
  body: string;
  status: string;
  kind: string;
  labels: string[];
  assignee_id: string | null;
  author_id: string;
  cycle_id: string | null;
  milestone_id: string | null;
  created_at: string;
  updated_at: string;
}

export function registerIssueDetailsTool(server: McpServer) {
  server.tool(
    'get_issue',
    'Get the full content of a FerrTrack issue by its ref (e.g. "FT-12") — title, body, status, kind, labels, assignee.',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
    },
    async ({ issue_ref }) => {
      const token = await getToken();
      const issue = await apiRequest<IssueDetails>(`/v1/issues/${encodeURIComponent(issue_ref)}`, {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(issue) }],
      };
    },
  );
}

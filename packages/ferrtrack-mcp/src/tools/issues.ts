import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface Issue {
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

export function registerIssueTools(server: McpServer) {
  server.tool(
    'list_issues',
    'List FerrTrack issues in a project. Filter by status (open|in_progress|review|closed|all), kind (bug|feat|chore|docs), assignee, limit.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
      status: z
        .enum(['open', 'in_progress', 'review', 'closed', 'all'])
        .optional()
        .describe('Filter by issue status (default open).'),
      kind: z.enum(['bug', 'feat', 'chore', 'docs']).optional().describe('Filter by issue kind.'),
      assignee_id: z
        .string()
        .optional()
        .describe('Assignee UUID, or "me" for the authenticated user.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max issues to return (default 50).'),
    },
    async ({ project_slug, status, kind, assignee_id, limit }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (kind) params.set('kind', kind);
      if (assignee_id) params.set('assignee', assignee_id);
      if (limit !== undefined) params.set('limit', String(limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const issues = await apiRequest<Issue[]>(
        `/v1/projects/${encodeURIComponent(project_slug)}/issues${qs}`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(issues) }],
      };
    },
  );

  server.tool(
    'create_issue',
    'Create a new FerrTrack issue in a project. Returns the new issue including its `ref` (e.g. "FT-12").',
    {
      project_slug: z.string().min(1).describe('Project slug'),
      title: z.string().min(1).max(200).describe('Issue title'),
      body: z.string().max(100_000).optional().describe('Issue body (markdown).'),
      kind: z
        .enum(['bug', 'feat', 'chore', 'docs'])
        .optional()
        .describe('Issue kind (default feat).'),
      labels: z.array(z.string()).optional().describe('Label strings to apply on creation.'),
      assignee_id: z.string().uuid().optional().describe('User UUID to assign on creation.'),
    },
    async ({ project_slug, title, body, kind, labels, assignee_id }) => {
      const token = await getToken();
      const issue = await apiRequest<Issue>(
        `/v1/projects/${encodeURIComponent(project_slug)}/issues`,
        {
          token,
          baseUrl: TRACK_API_URL,
          method: 'POST',
          body: {
            title,
            body: body ?? '',
            kind: kind ?? 'feat',
            labels: labels ?? [],
            assignee_id: assignee_id ?? null,
          },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(issue) }],
      };
    },
  );

  server.tool(
    'update_issue',
    'Patch a FerrTrack issue — change title/body/status/kind, edit labels, or set/clear assignee. Only fields you pass are touched.',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
      title: z.string().min(1).max(200).optional(),
      body: z.string().max(100_000).optional(),
      status: z.enum(['open', 'in_progress', 'review', 'closed']).optional(),
      kind: z.enum(['bug', 'feat', 'chore', 'docs']).optional(),
      labels: z.array(z.string()).optional(),
      assignee_id: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .describe('User UUID; pass null to unassign.'),
    },
    async ({ issue_ref, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const issue = await apiRequest<Issue>(`/v1/issues/${encodeURIComponent(issue_ref)}`, {
        token,
        baseUrl: TRACK_API_URL,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(issue) }],
      };
    },
  );

  server.tool(
    'list_issue_links',
    'List GitHub PR ↔ FerrTrack issue links for one issue (created by the GitHub webhook on push).',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
    },
    async ({ issue_ref }) => {
      const token = await getToken();
      const links = await apiRequest<unknown>(`/v1/issues/${encodeURIComponent(issue_ref)}/links`, {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(links) }],
      };
    },
  );
}

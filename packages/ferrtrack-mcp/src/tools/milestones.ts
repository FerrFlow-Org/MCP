import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function registerMilestoneTools(server: McpServer) {
  server.tool(
    'get_milestone',
    'Get a single FerrTrack milestone by id.',
    {
      milestone_id: z.string().min(1).describe('Milestone id'),
    },
    async ({ milestone_id }) => {
      const token = await getToken();
      const milestone = await apiRequest<Milestone>(
        `/v1/milestones/${encodeURIComponent(milestone_id)}`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(milestone) }],
      };
    },
  );

  server.tool(
    'list_milestones',
    'List milestones for a FerrTrack project.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
    },
    async ({ project_slug }) => {
      const token = await getToken();
      const milestones = await apiRequest<Milestone[]>(
        `/v1/projects/${encodeURIComponent(project_slug)}/milestones`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(milestones) }],
      };
    },
  );

  server.tool(
    'create_milestone',
    'Create a milestone on a project. Due date is optional.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
      name: z.string().min(1).max(100),
      description: z.string().max(2000).optional(),
      due_at: z.string().optional().describe('ISO date.'),
    },
    async ({ project_slug, name, description, due_at }) => {
      const token = await getToken();
      const milestone = await apiRequest<Milestone>(
        `/v1/projects/${encodeURIComponent(project_slug)}/milestones`,
        {
          token,
          baseUrl: TRACK_API_URL,
          method: 'POST',
          body: {
            name,
            description: description ?? null,
            due_at: due_at ?? null,
          },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(milestone) }],
      };
    },
  );

  server.tool(
    'update_milestone',
    'Patch a milestone — rename, retitle description, shift due date, flip status.',
    {
      milestone_id: z.string().min(1).describe('Milestone id'),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(2000).nullable().optional(),
      due_at: z.string().nullable().optional(),
      status: z.enum(['open', 'completed', 'cancelled']).optional(),
    },
    async ({ milestone_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const milestone = await apiRequest<Milestone>(
        `/v1/milestones/${encodeURIComponent(milestone_id)}`,
        { token, baseUrl: TRACK_API_URL, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(milestone) }],
      };
    },
  );

  server.tool(
    'delete_milestone',
    'Delete a milestone. Issues that were on it become un-milestoned.',
    {
      milestone_id: z.string().min(1).describe('Milestone id'),
    },
    async ({ milestone_id }) => {
      const token = await getToken();
      await apiRequest<void>(`/v1/milestones/${encodeURIComponent(milestone_id)}`, {
        token,
        baseUrl: TRACK_API_URL,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Milestone ${milestone_id} deleted.` }],
      };
    },
  );
}

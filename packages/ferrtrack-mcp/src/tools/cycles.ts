import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface Cycle {
  id: string;
  project_id: string;
  number: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CycleIssue {
  id: string;
  ref: string;
  title: string;
  status: string;
  assignee_id: string | null;
}

export function registerCycleTools(server: McpServer) {
  server.tool(
    'get_cycle',
    'Get a single FerrTrack cycle by id.',
    {
      cycle_id: z.string().min(1).describe('Cycle id'),
    },
    async ({ cycle_id }) => {
      const token = await getToken();
      const cycle = await apiRequest<Cycle>(`/v1/cycles/${encodeURIComponent(cycle_id)}`, {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(cycle) }],
      };
    },
  );

  server.tool(
    'list_cycles',
    'List cycles (sprints) for a FerrTrack project.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
    },
    async ({ project_slug }) => {
      const token = await getToken();
      const cycles = await apiRequest<Cycle[]>(
        `/v1/projects/${encodeURIComponent(project_slug)}/cycles`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(cycles) }],
      };
    },
  );

  server.tool(
    'list_cycle_issues',
    'List the issues currently assigned to a FerrTrack cycle.',
    {
      cycle_id: z.string().min(1).describe('Cycle id'),
    },
    async ({ cycle_id }) => {
      const token = await getToken();
      const issues = await apiRequest<CycleIssue[]>(
        `/v1/cycles/${encodeURIComponent(cycle_id)}/issues`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(issues) }],
      };
    },
  );

  server.tool(
    'create_cycle',
    'Create a new cycle in a project. Dates are ISO 8601 (YYYY-MM-DD).',
    {
      project_slug: z.string().min(1).describe('Project slug'),
      name: z.string().min(1).max(100),
      starts_at: z.string().describe('ISO date — cycle start.'),
      ends_at: z.string().describe('ISO date — cycle end.'),
    },
    async ({ project_slug, name, starts_at, ends_at }) => {
      const token = await getToken();
      const cycle = await apiRequest<Cycle>(
        `/v1/projects/${encodeURIComponent(project_slug)}/cycles`,
        {
          token,
          baseUrl: TRACK_API_URL,
          method: 'POST',
          body: { name, starts_at, ends_at },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(cycle) }],
      };
    },
  );

  server.tool(
    'plan_next_cycle',
    'Trigger the auto-planner to generate the next cycle from the project backlog. Returns the newly created cycle.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
    },
    async ({ project_slug }) => {
      const token = await getToken();
      const cycle = await apiRequest<Cycle>(
        `/v1/projects/${encodeURIComponent(project_slug)}/cycles/plan`,
        { token, baseUrl: TRACK_API_URL, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(cycle) }],
      };
    },
  );

  server.tool(
    'update_cycle',
    'Patch a cycle — rename it, shift dates, or close it. Only fields you pass are touched.',
    {
      cycle_id: z.string().min(1).describe('Cycle id'),
      name: z.string().min(1).max(100).optional(),
      starts_at: z.string().optional(),
      ends_at: z.string().optional(),
      status: z.enum(['planned', 'active', 'completed']).optional(),
    },
    async ({ cycle_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const cycle = await apiRequest<Cycle>(`/v1/cycles/${encodeURIComponent(cycle_id)}`, {
        token,
        baseUrl: TRACK_API_URL,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(cycle) }],
      };
    },
  );

  server.tool(
    'delete_cycle',
    'Delete a cycle. Issues that were on it become un-cycled.',
    {
      cycle_id: z.string().min(1).describe('Cycle id'),
    },
    async ({ cycle_id }) => {
      const token = await getToken();
      await apiRequest<void>(`/v1/cycles/${encodeURIComponent(cycle_id)}`, {
        token,
        baseUrl: TRACK_API_URL,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Cycle ${cycle_id} deleted.` }],
      };
    },
  );
}

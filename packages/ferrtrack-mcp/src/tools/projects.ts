import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface Project {
  id: string;
  slug: string;
  prefix: string;
  name: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export function registerProjectTools(server: McpServer) {
  server.tool(
    'list_projects',
    "List FerrTrack projects in the caller's active organization.",
    {},
    async () => {
      const token = await getToken();
      const projects = await apiRequest<Project[]>('/v1/projects', {
        token,
        baseUrl: TRACK_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(projects) }],
      };
    },
  );

  server.tool(
    'get_project',
    'Get a FerrTrack project by slug.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
    },
    async ({ project_slug }) => {
      const token = await getToken();
      const project = await apiRequest<Project>(
        `/v1/projects/${encodeURIComponent(project_slug)}`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(project) }],
      };
    },
  );

  server.tool(
    'create_project',
    'Create a new FerrTrack project in the active organization. The `prefix` (2-9 uppercase letters) is used as the issue ref prefix, e.g. "FT" → issues "FT-1", "FT-2", …',
    {
      slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
      prefix: z.string().regex(/^[A-Z]{2,9}$/, 'prefix must be 2-9 uppercase letters'),
      name: z.string().min(1).max(100),
      summary: z.string().max(500).optional(),
    },
    async ({ slug, prefix, name, summary }) => {
      const token = await getToken();
      const project = await apiRequest<Project>('/v1/projects', {
        token,
        baseUrl: TRACK_API_URL,
        method: 'POST',
        body: {
          slug,
          prefix,
          name,
          summary: summary ?? null,
        },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(project) }],
      };
    },
  );

  server.tool(
    'update_project',
    'Patch a FerrTrack project — rename it or update its summary. Slug and prefix are immutable to keep issue refs stable.',
    {
      project_slug: z.string().min(1).describe('Project slug'),
      name: z.string().min(1).max(100).optional(),
      summary: z.string().max(500).nullable().optional(),
    },
    async ({ project_slug, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const project = await apiRequest<Project>(
        `/v1/projects/${encodeURIComponent(project_slug)}`,
        { token, baseUrl: TRACK_API_URL, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(project) }],
      };
    },
  );
}

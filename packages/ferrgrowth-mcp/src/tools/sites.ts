import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface Site {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function registerSiteTools(server: McpServer) {
  server.tool(
    'list_sites',
    "List FerrGrowth sites in the authenticated user's org.",
    {},
    async () => {
      const token = await getToken();
      const sites = await apiRequest<Site[]>('/v1/sites', { token, baseUrl: GROWTH_API_URL });
      return {
        content: [{ type: 'text' as const, text: toToolText(sites) }],
      };
    },
  );

  server.tool(
    'get_site',
    'Get details for a single FerrGrowth site (status, custom domain, etc.).',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const site = await apiRequest<Site>(`/v1/sites/${encodeURIComponent(site_id)}`, {
        token,
        baseUrl: GROWTH_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'create_site',
    'Create a new FerrGrowth site. The slug becomes the default `<slug>.ferrgrowth.app` subdomain until you attach a custom domain.',
    {
      slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/, 'lowercase alphanumeric + hyphens'),
      name: z.string().min(1).max(100),
    },
    async ({ slug, name }) => {
      const token = await getToken();
      const site = await apiRequest<Site>('/v1/sites', {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'POST',
        body: { slug, name },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'update_site',
    'Rename a FerrGrowth site or change its slug. Slug changes also move the default subdomain.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      name: z.string().min(1).max(100).optional(),
    },
    async ({ site_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const site = await apiRequest<Site>(`/v1/sites/${encodeURIComponent(site_id)}`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'PATCH',
        body,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(site) }],
      };
    },
  );

  server.tool(
    'archive_site',
    "Archive a FerrGrowth site — takes it offline and stops serving its custom domain. Reversible via the dashboard; this MCP doesn't expose unarchive.",
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      await apiRequest<void>(`/v1/sites/${encodeURIComponent(site_id)}`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Site ${site_id} archived.` }],
      };
    },
  );

  server.tool(
    'attach_domain',
    'Attach a custom domain to a FerrGrowth site. The domain is registered in the pending state until verify_domain succeeds — DNS-01 verification via a TXT record.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      domain: z
        .string()
        .min(3)
        .max(253)
        .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'looks like a valid domain'),
    },
    async ({ site_id, domain }) => {
      const token = await getToken();
      const result = await apiRequest<unknown>(`/v1/sites/${encodeURIComponent(site_id)}/domain`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'POST',
        body: { domain },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'verify_domain',
    "Verify the custom domain previously attached to a FerrGrowth site. Checks the DNS TXT challenge — succeeds when the challenge matches, fails otherwise. Idempotent: retry after fixing DNS if it's not propagated yet.",
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const result = await apiRequest<unknown>(
        `/v1/sites/${encodeURIComponent(site_id)}/domain/verify`,
        { token, baseUrl: GROWTH_API_URL, method: 'POST' },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'detach_domain',
    'Detach the custom domain from a FerrGrowth site. The site falls back to its `<slug>.ferrgrowth.app` subdomain.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      await apiRequest<void>(`/v1/sites/${encodeURIComponent(site_id)}/domain`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `Custom domain detached from ${site_id}.` }],
      };
    },
  );
}

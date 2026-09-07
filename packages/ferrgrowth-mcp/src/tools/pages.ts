import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface Page {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export function registerPageTools(server: McpServer) {
  server.tool(
    'list_pages',
    'List pages on a FerrGrowth site.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const pages = await apiRequest<Page[]>(`/v1/sites/${encodeURIComponent(site_id)}/pages`, {
        token,
        baseUrl: GROWTH_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(pages) }],
      };
    },
  );

  server.tool(
    'get_page',
    'Get a single FerrGrowth page (full content + metadata).',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      page_slug: z.string().min(1).describe('Page slug'),
    },
    async ({ site_id, page_slug }) => {
      const token = await getToken();
      const page = await apiRequest<Page>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'publish_page',
    "Publish a FerrGrowth page — flips it live on the site's active release. Idempotent: re-publishing an already-live page is a no-op.",
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      page_slug: z.string().min(1).describe('Page slug'),
    },
    async ({ site_id, page_slug }) => {
      const token = await getToken();
      const page = await apiRequest<Page>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}/publish`,
        { token, method: 'POST', baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'create_page',
    'Create a new page on a FerrGrowth site. Newly created pages are unpublished by default — call publish_page when ready.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      slug: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9/-]+$/, 'lowercase alphanumeric + slashes + hyphens'),
      title: z.string().min(1).max(200),
      content: z
        .string()
        .optional()
        .describe('Initial markdown/MDX body. Optional — pages can start blank.'),
    },
    async ({ site_id, slug, title, content }) => {
      const token = await getToken();
      const page = await apiRequest<Page>(`/v1/sites/${encodeURIComponent(site_id)}/pages`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'POST',
        body: { slug, title, content: content ?? '' },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'update_page',
    'Patch a FerrGrowth page — title, slug, or content. Only fields you pass are touched. Publishing remains via publish_page.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      page_slug: z.string().min(1).describe('Page slug'),
      title: z.string().min(1).max(200).optional(),
      new_slug: z
        .string()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9/-]+$/)
        .optional()
        .describe('Rename the page slug (and its URL).'),
      content: z.string().optional(),
    },
    async ({ site_id, page_slug, new_slug, ...rest }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      if (new_slug !== undefined) body.slug = new_slug;
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) body[k] = v;
      }
      const page = await apiRequest<Page>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}`,
        { token, baseUrl: GROWTH_API_URL, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(page) }],
      };
    },
  );

  server.tool(
    'discover_pages',
    'Crawl a URL and discover candidate pages to import into a FerrGrowth site (sitemap / link graph). Returns a list of candidate page slugs + titles; no pages are created yet — feed the result to import_pages.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      url: z.string().url().describe('Origin URL to crawl.'),
    },
    async ({ site_id, url }) => {
      const token = await getToken();
      const result = await apiRequest<unknown>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/discover`,
        {
          token,
          baseUrl: GROWTH_API_URL,
          method: 'POST',
          body: { url },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );

  server.tool(
    'import_pages',
    'Import the pages discovered by discover_pages into the site. Each item creates an unpublished page; review then publish_page when ready.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      pages: z
        .array(
          z.object({
            url: z.string().url(),
            slug: z.string().min(1).max(80),
            title: z.string().min(1).max(200),
          }),
        )
        .min(1)
        .describe('Pages to import (typically the output of discover_pages).'),
    },
    async ({ site_id, pages }) => {
      const token = await getToken();
      const result = await apiRequest<unknown>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/import`,
        {
          token,
          baseUrl: GROWTH_API_URL,
          method: 'POST',
          body: { pages },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );
}

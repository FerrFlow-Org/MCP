import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface SeoOverview {
  site_id: string;
  pages_audited: number;
  average_score: number | null;
  worst_pages: Array<{ page_slug: string; score: number; issues: number }>;
}

interface SeoAuditResult {
  id: string;
  site_id: string;
  page_slug: string;
  score: number;
  issues: Array<{ severity: string; rule: string; message: string }>;
  created_at: string;
}

export function registerSeoTools(server: McpServer) {
  server.tool(
    'get_seo_overview',
    'Aggregated SEO scores across all audited pages of a FerrGrowth site, with the worst offenders listed.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const overview = await apiRequest<SeoOverview>(
        `/v1/sites/${encodeURIComponent(site_id)}/audits/seo/overview`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(overview) }],
      };
    },
  );

  server.tool(
    'run_seo_audit',
    'Run a fresh SEO audit on a single FerrGrowth page. Returns the score plus a list of issues by severity.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      page_slug: z.string().min(1).describe('Page slug'),
    },
    async ({ site_id, page_slug }) => {
      const token = await getToken();
      const result = await apiRequest<SeoAuditResult>(
        `/v1/sites/${encodeURIComponent(site_id)}/pages/${encodeURIComponent(page_slug)}/audits/seo`,
        { token, method: 'POST', baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(result) }],
      };
    },
  );
}

import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface AnalyticsSummary {
  site_id: string;
  range: { from: string; to: string };
  total_visits: number;
  unique_visitors: number;
  top_pages: Array<{ path: string; visits: number }>;
  top_referrers: Array<{ source: string; visits: number }>;
}

export function registerAnalyticsTools(server: McpServer) {
  server.tool(
    'get_analytics_summary',
    "Visit + referrer summary for a FerrGrowth site. Optional ISO date range, otherwise the API's default window applies.",
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      from: z
        .string()
        .optional()
        .describe('ISO 8601 start (e.g. 2026-05-01). Defaults to last 30 days.'),
      to: z.string().optional().describe('ISO 8601 end (e.g. 2026-05-22).'),
    },
    async ({ site_id, from, to }) => {
      const token = await getToken();
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const summary = await apiRequest<AnalyticsSummary>(
        `/v1/sites/${encodeURIComponent(site_id)}/analytics${qs}`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(summary) }],
      };
    },
  );
}

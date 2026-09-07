import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, toToolText } from '@ferrlabs/mcp-core';

interface PublicStats {
  total_releases: number;
  total_repos: number;
  total_commits_analyzed: number;
}

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  checks?: Record<string, string>;
}

export function registerStatsTools(server: McpServer) {
  server.tool(
    'get_stats',
    'Get public FerrLabs usage statistics (releases cut, repos using FerrFlow, commits analyzed)',
    {},
    async () => {
      const stats = await apiRequest<PublicStats>('/stats');
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(stats),
          },
        ],
      };
    },
  );

  server.tool('health_check', 'Check FerrLabs API health status', {}, async () => {
    const health = await apiRequest<HealthResponse>('/health');
    return {
      content: [
        {
          type: 'text' as const,
          text: toToolText(health),
        },
      ],
    };
  });
}

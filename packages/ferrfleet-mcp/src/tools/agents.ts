import { z } from 'zod';
import { getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { fleetRequest } from '../api-base.js';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  first_party_for_product: string | null;
  created_at: string;
  updated_at: string;
}

export function registerAgentTools(server: McpServer) {
  server.tool(
    'list_agents',
    'List FerrFleet agents available to the authenticated user (marketplace + custom).',
    {},
    async () => {
      const token = await getToken();
      const agents = await fleetRequest<Agent[]>('/agents', { token });
      return {
        content: [{ type: 'text' as const, text: toToolText(agents) }],
      };
    },
  );

  server.tool(
    'get_agent',
    'Get full details of a FerrFleet agent (manifest, scopes, last run).',
    {
      agent_id: z.string().min(1).describe('Agent id'),
    },
    async ({ agent_id }) => {
      const token = await getToken();
      const agent = await fleetRequest<Agent>(`/agents/${encodeURIComponent(agent_id)}`, { token });
      return {
        content: [{ type: 'text' as const, text: toToolText(agent) }],
      };
    },
  );

  server.tool(
    'trigger_agent_run',
    'Trigger a new run of a FerrFleet agent. Returns the freshly-created run id — poll get_run for status or pull get_run_transcript when finished.',
    {
      agent_id: z.string().min(1).describe('Agent id'),
      input: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Optional structured input passed to the agent at run start.'),
      reason: z
        .string()
        .max(500)
        .optional()
        .describe('Free-text reason recorded with the run (audit trail).'),
    },
    async ({ agent_id, input, reason }) => {
      const token = await getToken();
      const run = await fleetRequest<{ id: string; status: string; created_at: string }>(
        `/agents/${encodeURIComponent(agent_id)}/runs`,
        {
          token,
          method: 'POST',
          body: { input: input ?? {}, reason: reason ?? null },
        },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(run) }],
      };
    },
  );
}

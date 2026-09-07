import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, toToolText } from '@ferrlabs/mcp-core';
import { getToken } from '@ferrlabs/mcp-core';

interface SubscriptionRow {
  id: string;
  product: string;
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export function registerSubscriptionsTools(server: McpServer) {
  server.tool(
    'list_subscriptions',
    'List FerrLabs product subscriptions for an organization (FerrVault, FerrTrack, FerrGrowth, FerrFleet)',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const subs = await apiRequest<SubscriptionRow[]>(
        `/orgs/${encodeURIComponent(org_slug)}/subscriptions`,
        { token },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(subs) }],
      };
    },
  );

  const PRODUCTS = ['ferrvault', 'ferrtrack', 'ferrgrowth', 'ferrfleet', 'ferrlens'] as const;
  const TIERS = ['free', 'pro', 'team', 'enterprise'] as const;

  server.tool(
    'activate_subscription',
    'Activate a product subscription on an organization. Starts the trial clock when applicable. Caller must be an org owner/admin; the API enforces billing-info presence for paid tiers.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      product: z.enum(PRODUCTS),
      tier: z.enum(TIERS).default('free').describe('Tier (default free).'),
    },
    async ({ org_slug, product, tier }) => {
      const token = await getToken();
      const sub = await apiRequest<SubscriptionRow>(
        `/orgs/${encodeURIComponent(org_slug)}/subscriptions`,
        { token, method: 'POST', body: { product, tier } },
      );
      return { content: [{ type: 'text' as const, text: toToolText(sub) }] };
    },
  );

  server.tool(
    'update_subscription',
    'Change the tier of an active product subscription (upgrade/downgrade). Stripe proration is applied per the API config.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      product: z.enum(PRODUCTS),
      tier: z.enum(TIERS),
    },
    async ({ org_slug, product, tier }) => {
      const token = await getToken();
      const sub = await apiRequest<SubscriptionRow>(
        `/orgs/${encodeURIComponent(org_slug)}/subscriptions/${encodeURIComponent(product)}`,
        { token, method: 'PATCH', body: { tier } },
      );
      return { content: [{ type: 'text' as const, text: toToolText(sub) }] };
    },
  );

  server.tool(
    'cancel_subscription',
    'Cancel a product subscription on an organization. By default the cancellation takes effect at the end of the current billing period; pass immediate=true to cut it off now (with proration).',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      product: z.enum(PRODUCTS),
      immediate: z
        .boolean()
        .optional()
        .describe(
          'Cut off immediately and refund prorated amount. Default false (cancel at period end).',
        ),
    },
    async ({ org_slug, product, immediate }) => {
      const token = await getToken();
      const qs = immediate ? '?immediate=true' : '';
      await apiRequest<void>(
        `/orgs/${encodeURIComponent(org_slug)}/subscriptions/${encodeURIComponent(product)}${qs}`,
        { token, method: 'DELETE' },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Subscription ${product} on ${org_slug} ${immediate ? 'cancelled immediately' : 'set to cancel at period end'}.`,
          },
        ],
      };
    },
  );
}

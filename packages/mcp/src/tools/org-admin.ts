import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, getToken, toToolText } from '@ferrlabs/mcp-core';

interface Org {
  id: string;
  slug: string;
  name: string;
  plan: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface OrgOverview {
  org: Org;
  member_count: number;
  active_subscriptions: Array<{ product: string; tier: string; status: string }>;
  pending_invites: number;
  recent_activity_count: number;
}

interface OrgUsage {
  org_slug: string;
  period: { from: string; to: string };
  per_product: Array<{
    product: string;
    metric: string;
    used: number;
    limit: number | null;
  }>;
}

interface OrgMember {
  user_id: string;
  email: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
}

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

function orgBase(slug: string): string {
  return `/orgs/${encodeURIComponent(slug)}`;
}

export function registerOrgAdminTools(server: McpServer) {
  server.tool(
    'get_org',
    'Get a single FerrLabs organization by slug.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const org = await apiRequest<Org>(orgBase(org_slug), { token });
      return { content: [{ type: 'text' as const, text: toToolText(org) }] };
    },
  );

  server.tool(
    'update_org',
    'Patch an organization — rename it or change its slug. Slug changes propagate everywhere; double-check before doing it on a live org.',
    {
      org_slug: z.string().min(1).describe('Current organization slug'),
      name: z.string().min(1).max(100).optional(),
      new_slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9-]+$/)
        .optional()
        .describe('New slug (lowercase alphanumeric + hyphens).'),
    },
    async ({ org_slug, name, new_slug }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (new_slug !== undefined) body.slug = new_slug;
      const org = await apiRequest<Org>(orgBase(org_slug), {
        token,
        method: 'PATCH',
        body,
      });
      return { content: [{ type: 'text' as const, text: toToolText(org) }] };
    },
  );

  server.tool(
    'get_org_overview',
    'High-level dashboard view of an organization — member count, active subscriptions per product, pending invites, recent activity volume.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const overview = await apiRequest<OrgOverview>(`${orgBase(org_slug)}/overview`, { token });
      return { content: [{ type: 'text' as const, text: toToolText(overview) }] };
    },
  );

  server.tool(
    'get_org_usage',
    'Current-period metered usage across all products for an org (FerrGrowth visits/bandwidth, FerrFleet runs, etc.) with limits per tier.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const usage = await apiRequest<OrgUsage>(`${orgBase(org_slug)}/usage`, { token });
      return { content: [{ type: 'text' as const, text: toToolText(usage) }] };
    },
  );

  server.tool(
    'list_org_audit',
    'Recent audit log for an organization — member changes, subscription updates, sensitive admin actions.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Max entries to return (default 50).'),
    },
    async ({ org_slug, limit }) => {
      const token = await getToken();
      const qs = limit !== undefined ? `?limit=${limit}` : '';
      const entries = await apiRequest<AuditEntry[]>(`${orgBase(org_slug)}/audit${qs}`, { token });
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(entries, { narrowWith: 'Pass a smaller limit.' }),
          },
        ],
      };
    },
  );

  // --------------------------------------------------------------------------
  // Members
  // --------------------------------------------------------------------------

  server.tool(
    'list_org_members',
    'Members of an organization with their roles. Useful to look up a user_id before assigning issues or granting team membership.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const members = await apiRequest<OrgMember[]>(`${orgBase(org_slug)}/members`, { token });
      return { content: [{ type: 'text' as const, text: toToolText(members) }] };
    },
  );

  server.tool(
    'invite_org_member',
    'Invite a user (by email) to join an organization with a specific role. The user receives an invitation email; they appear in list_org_members once they accept.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      email: z.string().email().describe('Invitee email address'),
      role: z
        .enum(['admin', 'member', 'viewer'])
        .default('member')
        .describe(
          'Org-level role (default member). Owners can only be promoted from existing admins.',
        ),
    },
    async ({ org_slug, email, role }) => {
      const token = await getToken();
      const member = await apiRequest<OrgMember>(`${orgBase(org_slug)}/members`, {
        token,
        method: 'POST',
        body: { email, role },
      });
      return { content: [{ type: 'text' as const, text: toToolText(member) }] };
    },
  );

  server.tool(
    'update_org_member_role',
    "Change a member's role inside an organization. Promoting to owner requires the caller to be an owner.",
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      user_id: z.string().min(1).describe('User id of the member to update'),
      role: z.enum(['owner', 'admin', 'member', 'viewer']),
    },
    async ({ org_slug, user_id, role }) => {
      const token = await getToken();
      const member = await apiRequest<OrgMember>(
        `${orgBase(org_slug)}/members/${encodeURIComponent(user_id)}`,
        { token, method: 'PATCH', body: { role } },
      );
      return { content: [{ type: 'text' as const, text: toToolText(member) }] };
    },
  );

  server.tool(
    'remove_org_member',
    'Remove a user from an organization. Irreversible; the user can be re-invited.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      user_id: z.string().min(1).describe('User id of the member to remove'),
    },
    async ({ org_slug, user_id }) => {
      const token = await getToken();
      await apiRequest<void>(`${orgBase(org_slug)}/members/${encodeURIComponent(user_id)}`, {
        token,
        method: 'DELETE',
      });
      return {
        content: [{ type: 'text' as const, text: `User ${user_id} removed from ${org_slug}.` }],
      };
    },
  );

  // --------------------------------------------------------------------------
  // Teams
  // --------------------------------------------------------------------------

  server.tool(
    'list_teams',
    'List teams (sub-groups) inside an organization. Teams are used for fine-grained permissions and assignee groups.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
    },
    async ({ org_slug }) => {
      const token = await getToken();
      const teams = await apiRequest<Team[]>(`${orgBase(org_slug)}/teams`, { token });
      return { content: [{ type: 'text' as const, text: toToolText(teams) }] };
    },
  );

  server.tool(
    'create_team',
    'Create a new team inside an organization. Teams start empty — add members with add_team_member.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    },
    async ({ org_slug, name, description }) => {
      const token = await getToken();
      const team = await apiRequest<Team>(`${orgBase(org_slug)}/teams`, {
        token,
        method: 'POST',
        body: { name, description: description ?? null },
      });
      return { content: [{ type: 'text' as const, text: toToolText(team) }] };
    },
  );

  server.tool(
    'update_team',
    'Patch a team — rename or change description.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      team_id: z.string().min(1).describe('Team id'),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).nullable().optional(),
    },
    async ({ org_slug, team_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const team = await apiRequest<Team>(
        `${orgBase(org_slug)}/teams/${encodeURIComponent(team_id)}`,
        { token, method: 'PATCH', body },
      );
      return { content: [{ type: 'text' as const, text: toToolText(team) }] };
    },
  );

  server.tool(
    'delete_team',
    'Delete a team. Members of the team are NOT removed from the org; they just lose team-scoped permissions.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      team_id: z.string().min(1).describe('Team id'),
    },
    async ({ org_slug, team_id }) => {
      const token = await getToken();
      await apiRequest<void>(`${orgBase(org_slug)}/teams/${encodeURIComponent(team_id)}`, {
        token,
        method: 'DELETE',
      });
      return { content: [{ type: 'text' as const, text: `Team ${team_id} deleted.` }] };
    },
  );

  server.tool(
    'add_team_member',
    'Add a user (already an org member) to a team.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      team_id: z.string().min(1).describe('Team id'),
      user_id: z.string().min(1).describe('User id to add'),
    },
    async ({ org_slug, team_id, user_id }) => {
      const token = await getToken();
      const result = await apiRequest<unknown>(
        `${orgBase(org_slug)}/teams/${encodeURIComponent(team_id)}/members`,
        { token, method: 'POST', body: { user_id } },
      );
      return { content: [{ type: 'text' as const, text: toToolText(result) }] };
    },
  );

  server.tool(
    'remove_team_member',
    'Remove a user from a team. The user remains an org member.',
    {
      org_slug: z.string().min(1).describe('Organization slug'),
      team_id: z.string().min(1).describe('Team id'),
      user_id: z.string().min(1).describe('User id to remove'),
    },
    async ({ org_slug, team_id, user_id }) => {
      const token = await getToken();
      await apiRequest<void>(
        `${orgBase(org_slug)}/teams/${encodeURIComponent(team_id)}/members/${encodeURIComponent(user_id)}`,
        { token, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `User ${user_id} removed from team ${team_id}.` }],
      };
    },
  );
}

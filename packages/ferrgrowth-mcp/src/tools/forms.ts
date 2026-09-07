import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { GROWTH_API_URL } from '../api-base.js';

interface Form {
  id: string;
  site_id: string;
  name: string;
  fields: Array<{ name: string; type: string; required: boolean }>;
  created_at: string;
  updated_at: string;
}

interface FormSubmission {
  id: string;
  form_id: string;
  values: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export function registerFormTools(server: McpServer) {
  server.tool(
    'get_form',
    'Get the schema of a single FerrGrowth form (fields, validation, name).',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      form_id: z.string().min(1).describe('Form id'),
    },
    async ({ site_id, form_id }) => {
      const token = await getToken();
      const form = await apiRequest<Form>(
        `/v1/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'list_forms',
    'List forms attached to a FerrGrowth site.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
    },
    async ({ site_id }) => {
      const token = await getToken();
      const forms = await apiRequest<Form[]>(`/v1/sites/${encodeURIComponent(site_id)}/forms`, {
        token,
        baseUrl: GROWTH_API_URL,
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(forms) }],
      };
    },
  );

  server.tool(
    'list_form_submissions',
    'List submissions for a FerrGrowth form, most recent first.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      form_id: z.string().min(1).describe('Form id'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Max submissions to return (default 50).'),
    },
    async ({ site_id, form_id, limit }) => {
      const token = await getToken();
      const qs = limit !== undefined ? `?limit=${limit}` : '';
      const subs = await apiRequest<FormSubmission[]>(
        `/v1/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}/submissions${qs}`,
        { token, baseUrl: GROWTH_API_URL },
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: toToolText(subs, { narrowWith: 'Pass a smaller limit.' }),
          },
        ],
      };
    },
  );

  server.tool(
    'create_form',
    'Create a new form on a FerrGrowth site. Fields are typed; submissions land in list_form_submissions.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      name: z.string().min(1).max(100),
      fields: z
        .array(
          z.object({
            name: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[a-z][a-z0-9_]*$/, 'snake_case identifier'),
            type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number']),
            required: z.boolean().optional(),
          }),
        )
        .min(1)
        .describe('Form schema — at least one field.'),
    },
    async ({ site_id, name, fields }) => {
      const token = await getToken();
      const form = await apiRequest<Form>(`/v1/sites/${encodeURIComponent(site_id)}/forms`, {
        token,
        baseUrl: GROWTH_API_URL,
        method: 'POST',
        body: { name, fields },
      });
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'update_form',
    'Patch a FerrGrowth form — rename it or replace the field schema. Only fields you pass are touched.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      form_id: z.string().min(1).describe('Form id'),
      name: z.string().min(1).max(100).optional(),
      fields: z
        .array(
          z.object({
            name: z.string().min(1).max(80),
            type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number']),
            required: z.boolean().optional(),
          }),
        )
        .optional(),
    },
    async ({ site_id, form_id, ...patch }) => {
      const token = await getToken();
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) body[k] = v;
      }
      const form = await apiRequest<Form>(
        `/v1/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}`,
        { token, baseUrl: GROWTH_API_URL, method: 'PATCH', body },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(form) }],
      };
    },
  );

  server.tool(
    'delete_form',
    'Delete a FerrGrowth form. Existing submissions are kept in the audit table; the form definition is removed.',
    {
      site_id: z.string().min(1).describe('Site id or slug'),
      form_id: z.string().min(1).describe('Form id'),
    },
    async ({ site_id, form_id }) => {
      const token = await getToken();
      await apiRequest<void>(
        `/v1/sites/${encodeURIComponent(site_id)}/forms/${encodeURIComponent(form_id)}`,
        { token, baseUrl: GROWTH_API_URL, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Form ${form_id} deleted.` }],
      };
    },
  );
}

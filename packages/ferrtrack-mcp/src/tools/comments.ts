import { z } from 'zod';
import { apiRequest, getToken, type McpServer, toToolText } from '@ferrlabs/mcp-core';
import { TRACK_API_URL } from '../api-base.js';

interface Comment {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export function registerCommentTools(server: McpServer) {
  server.tool(
    'list_issue_comments',
    'List all comments on a FerrTrack issue by its ref (e.g. "FT-12").',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
    },
    async ({ issue_ref }) => {
      const token = await getToken();
      const comments = await apiRequest<Comment[]>(
        `/v1/issues/${encodeURIComponent(issue_ref)}/comments`,
        { token, baseUrl: TRACK_API_URL },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(comments) }],
      };
    },
  );

  server.tool(
    'create_issue_comment',
    'Post a new comment on a FerrTrack issue. Body supports markdown.',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
      body: z.string().min(1).describe('Comment body (markdown).'),
    },
    async ({ issue_ref, body }) => {
      const token = await getToken();
      const comment = await apiRequest<Comment>(
        `/v1/issues/${encodeURIComponent(issue_ref)}/comments`,
        { token, baseUrl: TRACK_API_URL, method: 'POST', body: { body } },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(comment) }],
      };
    },
  );

  server.tool(
    'update_issue_comment',
    'Edit a comment you authored on a FerrTrack issue.',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
      comment_id: z.string().min(1).describe('Comment id'),
      body: z.string().min(1).describe('New comment body (markdown).'),
    },
    async ({ issue_ref, comment_id, body }) => {
      const token = await getToken();
      const comment = await apiRequest<Comment>(
        `/v1/issues/${encodeURIComponent(issue_ref)}/comments/${encodeURIComponent(comment_id)}`,
        { token, baseUrl: TRACK_API_URL, method: 'PATCH', body: { body } },
      );
      return {
        content: [{ type: 'text' as const, text: toToolText(comment) }],
      };
    },
  );

  server.tool(
    'delete_issue_comment',
    'Delete a comment you authored on a FerrTrack issue.',
    {
      issue_ref: z.string().min(1).describe('Issue ref, e.g. "FT-12"'),
      comment_id: z.string().min(1).describe('Comment id'),
    },
    async ({ issue_ref, comment_id }) => {
      const token = await getToken();
      await apiRequest<void>(
        `/v1/issues/${encodeURIComponent(issue_ref)}/comments/${encodeURIComponent(comment_id)}`,
        { token, baseUrl: TRACK_API_URL, method: 'DELETE' },
      );
      return {
        content: [{ type: 'text' as const, text: `Comment ${comment_id} deleted.` }],
      };
    },
  );
}

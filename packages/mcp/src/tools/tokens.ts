import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, toToolText } from '@ferrlabs/mcp-core';
import { getToken } from '@ferrlabs/mcp-core';

interface UserProfile {
  id: string;
  email: string;
  email_verified: boolean;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface ApiTokenResponse {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

type CreateTokenResponse = ApiTokenResponse & {
  plaintext: string;
};

export function registerTokenTools(server: McpServer) {
  server.tool('get_me', 'Get the current authenticated FerrLabs user profile', {}, async () => {
    const token = await getToken();
    const user = await apiRequest<UserProfile>('/auth/me', { token });
    return {
      content: [
        {
          type: 'text' as const,
          text: toToolText(user),
        },
      ],
    };
  });

  server.tool('list_tokens', 'List all API tokens for the authenticated user', {}, async () => {
    const token = await getToken();
    const tokens = await apiRequest<ApiTokenResponse[]>('/auth/tokens', { token });
    return {
      content: [
        {
          type: 'text' as const,
          text: toToolText(tokens),
        },
      ],
    };
  });

  server.tool(
    'create_token',
    'Create a new FerrLabs API token. Disabled unless FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1, because the API shows the secret exactly once and returning it here writes it into the conversation transcript.',
    {
      name: z.string().min(1).max(100).describe('Token name'),
      scopes: z.array(z.string()).describe('Token scopes (e.g. ["*"] for all)'),
      expires_at: z.string().optional().describe('Expiration date (ISO 8601)'),
    },
    async ({ name, scopes, expires_at }) => {
      // Refuse before minting, not after. The API returns the plaintext once
      // and never again, so creating the token and then withholding the
      // secret would leave a live credential nobody can use.
      if (process.env.FERRLABS_MCP_ALLOW_TOKEN_REVEAL !== '1') {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: [
                'Refusing to create an API token.',
                '',
                'The secret is returned exactly once, at creation, so this tool would have to put it in its response — and tool results are written to the conversation transcript, which the client persists to disk and may ship in logs or telemetry. A long-lived credential would end up in places you did not choose.',
                '',
                'Create the token from app.ferrlabs.com → Settings → API Tokens instead.',
                '',
                'If you accept the exposure, restart the MCP server with FERRLABS_MCP_ALLOW_TOKEN_REVEAL=1. It is an environment variable rather than an argument on purpose: the decision belongs to whoever runs the server.',
              ].join('\n'),
            },
          ],
        };
      }

      const token = await getToken();
      const result = await apiRequest<CreateTokenResponse>('/auth/tokens', {
        method: 'POST',
        body: { name, scopes, expires_at },
        token,
      });
      const { plaintext, ...meta } = result;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Token created: ${plaintext}\n\nThis is the only time the secret is shown, and it is now in this transcript. Move it to your secret store, then treat the transcript as sensitive or revoke the token with revoke_token.\n\n${toToolText(meta)}`,
          },
        ],
      };
    },
  );

  server.tool(
    'revoke_token',
    'Revoke a FerrLabs API token by ID',
    {
      token_id: z.string().uuid().describe('Token ID to revoke'),
    },
    async ({ token_id }) => {
      const token = await getToken();
      await apiRequest<{ message: string }>(`/auth/tokens/${token_id}`, {
        method: 'DELETE',
        token,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Token ${token_id} revoked successfully.`,
          },
        ],
      };
    },
  );
}

<div align="center">

# FerrLabs MCP

**Let your AI assistant drive the FerrLabs suite.**

A [Model Context Protocol](https://modelcontextprotocol.io) server exposing FerrFlow, FerrVault,<br />
FerrTrack, FerrGrowth, FerrFleet and FerrLens through the unified FerrLabs API.

[![npm](https://img.shields.io/npm/v/@ferrlabs/mcp)](https://www.npmjs.com/package/@ferrlabs/mcp)
[![Quality Gate](https://sonar.ferrlabs.com/api/project_badges/measure?project=MCP&metric=alert_status&token=sqb_df3c6923234b4dc9cc88fdd1b251c8a54c3b7903)](https://sonar.ferrlabs.com/dashboard?id=MCP)
[![Maintainability](https://sonar.ferrlabs.com/api/project_badges/measure?project=MCP&metric=sqale_rating&token=sqb_df3c6923234b4dc9cc88fdd1b251c8a54c3b7903)](https://sonar.ferrlabs.com/dashboard?id=MCP)
[![License](https://img.shields.io/github/license/FerrLabs/MCP)](LICENSE)

[npm](https://www.npmjs.com/package/@ferrlabs/mcp) | [FerrLabs](https://ferrlabs.com) | [Changelog](https://ferrlabs.com/changelog/)

</div>

Runs locally over stdio, or over Streamable HTTP behind a gateway. The first tool call that needs
auth opens a browser for an OAuth loopback flow and saves the token, so there is no environment
variable to set up front.

## Quick Start

Add to your MCP client configuration (Claude Code, Cursor, etc.):

```json
{
  "mcpServers": {
    "ferrlabs": {
      "command": "npx",
      "args": ["-y", "@ferrlabs/mcp"]
    }
  }
}
```

The first time you call a tool that needs auth, the MCP opens `auth.ferrlabs.com` in your default browser (OAuth 2.0 loopback PKCE). After you click Allow, the token is saved locally and reused for future sessions. No env var required.

### CI / scripted / headless use

Bypass the browser dance by injecting a token directly:

```json
{
  "mcpServers": {
    "ferrlabs": {
      "command": "npx",
      "args": ["-y", "@ferrlabs/mcp"],
      "env": { "FERRLABS_API_TOKEN": "fl_..." }
    }
  }
}
```

Create the token from `app.ferrlabs.com` → Settings → API Tokens. It's forwarded as `x-api-token` to `api.ferrlabs.com`.

## MCP servers

This repo ships six MCP servers as separate npm packages. `@ferrlabs/mcp` is the unified entrypoint (orgs, billing, profile, public stats, docs); the four sub-MCPs target a specific product API. Add only the servers you need to your client config.

| Package           | npm               | Targets                      | Base URL env         |
| ----------------- | ----------------- | ---------------------------- | -------------------- |
| `@ferrlabs/mcp`   | `@ferrlabs/mcp`   | `api.ferrlabs.com` (unified) | `API_URL`            |
| `@ferrvault/mcp`  | `@ferrvault/mcp`  | FerrVault secrets            | `API_URL`            |
| `@ferrtrack/mcp`  | `@ferrtrack/mcp`  | `api.ferrtrack.com`          | `FERRTRACK_API_URL`  |
| `@ferrgrowth/mcp` | `@ferrgrowth/mcp` | `api.ferrgrowth.com`         | `FERRGROWTH_API_URL` |
| `@ferrfleet/mcp`  | `@ferrfleet/mcp`  | `api.ferrfleet.com`          | `FERRFLEET_API_URL`  |

All servers share the same auth resolution (env token or OAuth loopback, see below). Register several at once:

```json
{
  "mcpServers": {
    "ferrlabs": { "command": "npx", "args": ["-y", "@ferrlabs/mcp"] },
    "ferrvault": { "command": "npx", "args": ["-y", "@ferrvault/mcp"] },
    "ferrtrack": { "command": "npx", "args": ["-y", "@ferrtrack/mcp"] },
    "ferrgrowth": { "command": "npx", "args": ["-y", "@ferrgrowth/mcp"] },
    "ferrfleet": { "command": "npx", "args": ["-y", "@ferrfleet/mcp"] }
  }
}
```

Tools marked **destructive** below are irreversible or high-impact (spend quota, switch live serving, delete data). MCP clients should gate them behind a confirmation.

### `@ferrlabs/mcp` (unified)

| Tool                                                                                               | Scope  | Notes                                                             |
| -------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `get_stats`, `health_check`, `fetch_docs`                                                          | public | No auth required                                                  |
| `get_me`, `update_me`, `export_my_account`, `list_my_sessions`, `revoke_my_session`                | auth   | Current user                                                      |
| `list_orgs`, `get_org`, `get_org_overview`, `get_org_usage`, `update_org`, `list_org_audit`        | auth   | Organizations                                                     |
| `list_org_members`, `invite_org_member`, `remove_org_member`, `update_org_member_role`             | auth   | `remove_org_member` is **destructive**                            |
| `list_teams`, `create_team`, `update_team`, `delete_team`, `add_team_member`, `remove_team_member` | auth   | `delete_team` is **destructive**                                  |
| `list_projects`, `list_vaults`, `list_issues`                                                      | auth   | Cross-product lists                                               |
| `list_subscriptions`, `activate_subscription`, `update_subscription`, `cancel_subscription`        | auth   | `cancel_subscription` is **destructive**                          |
| `list_tokens`, `create_token`, `revoke_token`                                                      | auth   | `create_token` needs a session; `revoke_token` is **destructive** |

### `@ferrvault/mcp`

| Tool                                                               | Notes                                               |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `get_vault`, `list_secrets`, `get_secret`, `get_vault_audit_log`   | read                                                |
| `list_secret_requests`, `archive_secret_request`                   | secret-request workflow                             |
| `create_vault`, `update_vault`, `delete_vault`                     | `delete_vault` is **destructive**                   |
| `create_secret`, `update_secret`, `rotate_secret`, `delete_secret` | `rotate_secret`/`delete_secret` are **destructive** |

### `@ferrtrack/mcp`

| Tool                                                                                                               | Notes                                     |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `list_projects`, `get_project`, `create_project`, `update_project`                                                 | projects                                  |
| `list_issues`, `get_issue`, `create_issue`, `update_issue`, `list_issue_links`                                     | issues                                    |
| `list_issue_comments`, `create_issue_comment`, `update_issue_comment`, `delete_issue_comment`                      | `delete_issue_comment` is **destructive** |
| `list_cycles`, `get_cycle`, `create_cycle`, `update_cycle`, `delete_cycle`, `list_cycle_issues`, `plan_next_cycle` | `delete_cycle` is **destructive**         |
| `list_milestones`, `get_milestone`, `create_milestone`, `update_milestone`, `delete_milestone`                     | `delete_milestone` is **destructive**     |
| `list_track_users`, `search_track`                                                                                 | read                                      |

### `@ferrgrowth/mcp`

| Tool                                                                                                     | Notes                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `list_sites`, `get_site`, `create_site`, `update_site`, `archive_site`                                   | `archive_site` is **destructive**                             |
| `attach_domain`, `detach_domain`, `verify_domain`                                                        | custom domains                                                |
| `list_pages`, `get_page`, `create_page`, `update_page`, `publish_page`, `discover_pages`, `import_pages` | pages                                                         |
| `list_forms`, `get_form`, `create_form`, `update_form`, `delete_form`, `list_form_submissions`           | `delete_form` is **destructive**                              |
| `list_releases`, `get_release`, `activate_release`                                                       | `activate_release` is **destructive** (switches live serving) |
| `get_analytics_summary`, `get_seo_overview`, `run_seo_audit`                                             | read / audit                                                  |

### `@ferrfleet/mcp`

| Tool                                         | Notes                                                   |
| -------------------------------------------- | ------------------------------------------------------- |
| `list_agents`, `get_agent`                   | read                                                    |
| `list_runs`, `get_run`, `get_run_transcript` | read                                                    |
| `trigger_agent_run`                          | **destructive**, executes an agent and spends run quota |

FerrFlow CLI-specific tools (`dry_run`, `validate_config`, `read_config`, `read_changelog`, `list_release_tags`, `record_event`) were removed in v4.0.0. They required either a local FerrFlow CLI install or HMAC signing the MCP doesn't do. Use the FerrFlow CLI directly or fetch docs via `fetch_docs("ferrflow", "docs/...")`.

## Stack

| Component | Technology                         |
| --------- | ---------------------------------- |
| Runtime   | Node.js 22+                        |
| Language  | TypeScript                         |
| MCP SDK   | @modelcontextprotocol/sdk          |
| Transport | stdio (default) or Streamable HTTP |

## Configuration

| Variable                         | Description                                                                                                                                                  | Default                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `API_URL`                        | FerrLabs API base URL (no `/v1` suffix, paths are prefixed in code)                                                                                          | `https://api.ferrlabs.com`                                                |
| `FERRLABS_AUTH_URL`              | Auth SPA base URL (where the OAuth browser flow lands)                                                                                                       | `https://auth.ferrlabs.com`                                               |
| `FERRLABS_API_TOKEN`             | Pre-provisioned token. Bypasses the OAuth flow. Use for CI / scripted environments.                                                                          | _(unset)_                                                                 |
| `FERRFLOW_API_TOKEN`             | **Deprecated**, accepted as a fallback for backward compatibility with v3.x.                                                                                 | _(unset)_                                                                 |
| `FERRLABS_MCP_NO_OAUTH`          | Set to `1` to disable the OAuth fallback. Then `FERRLABS_API_TOKEN` becomes required.                                                                        | unset                                                                     |
| `FERRLABS_MCP_TOKEN_PATH`        | Override the path where the OAuth-acquired token is persisted.                                                                                               | `%APPDATA%\ferrlabs\mcp\token.json` / `~/.config/ferrlabs/mcp/token.json` |
| `FERRLABS_MCP_NO_PERSIST`        | Set to `1` to keep the token in memory only (re-auth on every cold start).                                                                                   | unset                                                                     |
| `FERRLABS_MCP_ALLOWED_API_HOSTS` | Extra hosts a token may be sent to, comma separated. The FerrLabs product APIs are allowed by default; anything else is refused. Loopback is always allowed. | —                                                                         |
| `FERRTRACK_API_URL`              | Base URL for the FerrTrack API (`@ferrtrack/mcp`).                                                                                                           | `https://api.ferrtrack.com`                                               |
| `FERRGROWTH_API_URL`             | Base URL for the FerrGrowth API (`@ferrgrowth/mcp`).                                                                                                         | `https://api.ferrgrowth.com`                                              |
| `FERRFLEET_API_URL`              | Base URL for the FerrFleet API (`@ferrfleet/mcp`).                                                                                                           | `https://api.ferrfleet.com`                                               |
| `FERRFLEET_API_VERSION`          | Contract version sent as `x-ferrfleet-api-version` by `@ferrfleet/mcp`.                                                                                      | `2026-08-04`                                                              |
| `FERRLABS_MCP_MODE`              | Transport: `stdio` (default) or `http` (Streamable HTTP). `--http` also selects http.                                                                        | `stdio`                                                                   |
| `PORT`                           | Port for the HTTP transport (`FERRLABS_MCP_MODE=http`).                                                                                                      | `3000`                                                                    |
| `HOST`                           | Bind address for the HTTP transport.                                                                                                                         | `0.0.0.0`                                                                 |

### HTTP transport

By default the server runs over stdio. Set `FERRLABS_MCP_MODE=http` (or pass `--http`) to expose the MCP over Streamable HTTP on `HOST:PORT` (`0.0.0.0:3000` by default), which is the mode the Docker image runs. Requests carry the bearer token in the `Authorization` header. Run the HTTP transport behind a gateway (e.g. Traefik) that terminates TLS and applies rate limiting / request-size caps; do not expose it directly on an untrusted network.

### How auth resolution works

On the first authenticated tool call, the MCP looks for a token in this order:

1. In-memory cache (set during this MCP process's lifetime)
2. `FERRLABS_API_TOKEN` (or `FERRFLOW_API_TOKEN`) env var
3. Persisted token file (`FERRLABS_MCP_TOKEN_PATH`)
4. **OAuth 2.0 loopback PKCE flow**: opens the user's browser at `FERRLABS_AUTH_URL` (`auth.ferrlabs.com`, the login SPA), captures the callback on `http://127.0.0.1:54321/cb`, then exchanges the code for a session token via `POST /v1/auth/exchange` on `API_URL` (`api.ferrlabs.com`). Token is persisted to step 3 for future sessions.

If you set `FERRLABS_MCP_NO_OAUTH=1`, step 4 is skipped, which is what you want in CI where opening a browser would hang.

> **Auth host split.** `auth.ferrlabs.com` is the user-facing login SPA (where the browser `authorize` step lands); `api.ferrlabs.com` performs the token exchange and serves the OAuth discovery metadata used by the HTTP transport. Configure `FERRLABS_AUTH_URL` for the former and `API_URL` for the latter. They are not interchangeable.

## Smoke test

`pnpm smoke` builds the server, spawns it over stdio, runs the MCP `initialize`/`tools/list` handshake, then calls `health_check` and `get_stats` against the real `api.ferrlabs.com`. Useful to confirm the server boots, registers all tools, and the API is reachable. Exits non-zero on any failure.

```
[PASS] initialize handshake, serverInfo: ferrlabs@6.5.0
[PASS] tools/list, N tools registered
[PASS] tools/call health_check, {"status":"ready", ...}
[PASS] tools/call get_stats, total_releases=N

Smoke: 4/4 OK
```

## Migrating the sub-MCP package names

The four product sub-MCPs moved to their product's npm scope in 8.0.0. The unified server and the shared core did not move.

| Old name               | New name          |
| ---------------------- | ----------------- |
| `@ferrlabs/mcp-vault`  | `@ferrvault/mcp`  |
| `@ferrlabs/mcp-track`  | `@ferrtrack/mcp`  |
| `@ferrlabs/mcp-growth` | `@ferrgrowth/mcp` |
| `@ferrlabs/mcp-fleet`  | `@ferrfleet/mcp`  |
| `@ferrlabs/mcp`        | unchanged         |
| `@ferrlabs/mcp-core`   | unchanged         |

Update the package name in your MCP client config; nothing else changes. Tools, arguments and environment variables are identical, and the servers still target the same product APIs.

npm has no redirect for a renamed package. The old names stay installable at 7.0.2 forever and are deprecated with a pointer here, but they receive no further releases, security fixes included. Move off them.

The binaries were renamed to match, so `ferrlabs-mcp-track` is now `ferrtrack-mcp`. That matters only if you invoke them directly rather than through `npx`. The GHCR images moved the same way, from `ghcr.io/ferrlabs/mcp-track` to `ghcr.io/ferrlabs/ferrtrack-mcp`; the old image tags stay published but stop receiving new versions.

## Migrating from `@ferrflow/mcp` v3.x

v4.0.0 renames the package and points the MCP at the unified FerrLabs API. To migrate:

1. Replace `@ferrflow/mcp` with `@ferrlabs/mcp` in your MCP client config.
2. Rename `FERRFLOW_API_TOKEN` → `FERRLABS_API_TOKEN` (the old name still works for one release).
3. If you were overriding `API_URL=https://api.ferrflow.com`, drop the override. The default is now `https://api.ferrlabs.com`.

Tokens issued by the legacy FerrFlow-only API are not valid against the unified API. Create a fresh one from `app.ferrlabs.com`.

## License

Mozilla Public License 2.0, see [LICENSE](LICENSE).

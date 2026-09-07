# Changelog

All notable changes to `mcp` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [8.1.0] - 2026-09-07

### Features

- feat(core): cap tool responses instead of dumping the whole payload into the context (#336)

## [8.0.6] - 2026-09-07

### Bug Fixes

- fix(mcp): refuse to mint an API token unless the operator opted into the transcript exposure (#334)

## [8.0.5] - 2026-09-07

### Bug Fixes

- fix(core): release the listener and the per-request server both transports leaked (#333)

## [8.0.4] - 2026-09-07

### Bug Fixes

- fix(core): stop leaking credentials through baseUrl, redirects and shared token state (#331)

## [8.0.3] - 2026-09-05

### Bug Fixes

- perf(ci): cancel superseded pull request runs (#328)

## [8.0.2] - 2026-09-04

### Bug Fixes

- fix(fleet): negotiate the API contract by date header instead of a v1 prefix (#323)

## [8.0.1] - 2026-09-03

### Bug Fixes

- fix(docker): build mcp-core before the workspace install injects it (#322)

## [8.0.0] - 2026-09-03

### Breaking Changes

- refactor!: move product sub-MCPs to their product npm scope (#319)

## [7.0.2] - 2026-09-03

### Bug Fixes

- fix(deps): pin fast-uri, hono, nanoid and qs above their advisories (#321)

## [7.0.1] - 2026-08-12

### Bug Fixes

- fix(docker): injecte les paquets du workspace dans l'image au lieu d'un lien mort (#265)
- fix(ci): accorde pull-requests write au job appelant les reusables (#260)

## [7.0.0] - 2026-08-09

### Breaking Changes

- feat!: appelle l'API FerrLabs à la racine, sans préfixe /v1 (#233)

## [6.5.5] - 2026-07-23

### Bug Fixes

- fix(ci): repair renovate-rebase.yml truncated by the pin sweep (#218)

## [6.5.4] - 2026-07-17

### Bug Fixes

- fix(ci): move pnpm overrides to workspace and patch hono (#209)

## [6.5.3] - 2026-06-13

### Bug Fixes

- fix(transport): harden HTTP transport CORS, bind, host, and body size (#188)

## [6.5.2] - 2026-06-12

### Bug Fixes

- fix(http): add timeout and redirect control to outbound fetch calls (#186)

## [6.5.1] - 2026-06-12

### Bug Fixes

- fix(server): read MCP server version from package.json at runtime (#183)

## [6.5.0] - 2026-06-06

### Features

- feat(mcp): admin tools — org/members/teams/billing/sessions/profile + gets/updates (#165)

## [6.4.1] - 2026-06-06

### Bug Fixes

- fix(http): emit RFC 6749 OAuth error body on 401 so mcp-remote can authenticate (#164)

## [6.4.0] - 2026-05-25

### Features

- feat(mcp): round out CRUD across vault, track, growth sub-MCPs (#150)

## [6.3.3] - 2026-05-25

### Bug Fixes

- fix(mcp-core): port-fallback works on EADDRINUSE (was async-reject vs sync try/catch) (#153)

## [6.3.2] - 2026-05-23

### Bug Fixes

- fix(mcp-core): handle CORS preflight so browser clients can authenticate (#148)

## [6.3.1] - 2026-05-22

### Bug Fixes

- fix(mcp-track): hit api.ferrtrack.com with real route shapes; add project tools (#147)

## [6.3.0] - 2026-05-22

### Features

- feat(mcp): broaden sub-MCP tool surfaces across vault, track, growth, fleet (#145)

## [6.2.2] - 2026-05-22

### Bug Fixes

- fix(mcp-core): clear persisted token + cache on 401 and retry OAuth on next call (#139)

## [6.2.1] - 2026-05-22

### Bug Fixes

- fix(http): point OAuth discovery at api.ferrlabs.com (auth.ferrlabs.com is the SPA, not metadata) (#136)

## [6.2.0] - 2026-05-21

### Features

- feat(http): OAuth protected-resource discovery — 401 + WWW-Authenticate triggers client OAuth flow (#128)

## [6.1.0] - 2026-05-21

### Features

- feat: add @ferrlabs/mcp-track, @ferrlabs/mcp-growth, @ferrlabs/mcp-fleet sub-MCPs (#127)

## [6.0.0] - 2026-05-21

### Breaking Changes

- feat(workspace)!: split MCP into pnpm workspace with shared mcp-core + sub-MCPs (#126)

## [5.2.5] - 2026-05-21

### Bug Fixes

- fix(http): return 404 on unknown session-id so clients can re-init transparently (#125)

## [5.2.4] - 2026-05-21

### Bug Fixes

- fix(api-client): forward token via Authorization Bearer too + surface non-JSON errors (#124)

## [5.2.3] - 2026-05-21

### Bug Fixes

- fix(docker): reuse node:alpine's built-in UID 1000 user (no addgroup conflict) (#123)

## [5.2.2] - 2026-05-21

### Bug Fixes

- fix(docker): pin app user to UID 1000 so K8s runAsNonRoot validates (#122)

## [5.2.1] - 2026-05-20

### Bug Fixes

- fix(docker): disable husky postinstall in Dockerfile build (no .git in context) (#121)

## [5.2.0] - 2026-05-20

### Features

- feat(transport): dual-transport — stdio default + Streamable HTTP for hosted use (#120)

## [5.1.1] - 2026-05-19

### Bug Fixes

- fix(auth): use rundll32 on Windows to avoid cmd & parsing breaking the OAuth URL (#119)

## [5.1.0] - 2026-05-19

### Features

- feat(auth): OAuth 2.0 loopback PKCE flow + persistence (closes #113) (#117)

## [Unreleased]

### Features

- feat(auth): OAuth 2.0 loopback PKCE flow on first authenticated tool call — the MCP opens `auth.ferrlabs.com` in the user's browser, captures the callback on a loopback port, and persists the token. No more manual `FERRLABS_API_TOKEN` paste for desktop users (#113)
- feat(auth): token persistence per OS conventions (`%APPDATA%\ferrlabs\mcp\token.json` on Windows, `~/.config/ferrlabs/mcp/token.json` on Linux, `~/Library/Application Support/...` on macOS). File mode `0600` on Unix.
- feat(auth): new env knobs — `FERRLABS_AUTH_URL` (override auth host), `FERRLABS_MCP_NO_OAUTH=1` (disable OAuth fallback for CI), `FERRLABS_MCP_TOKEN_PATH` (override persistence path), `FERRLABS_MCP_NO_PERSIST=1` (in-memory only)
- `FERRLABS_API_TOKEN` still works and short-circuits the OAuth dance — safe to keep in CI configs

## [5.0.0] - 2026-05-19

### Breaking Changes

- feat(license)!: relicense from MIT to MPL-2.0 to match FerrFlow (#116)

## [4.0.0] - 2026-05-19

### Breaking Changes

- feat!: rename package from `@ferrflow/mcp` to `@ferrlabs/mcp` (#111)
- feat!: default `API_URL` is now `https://api.ferrlabs.com` (was `https://api.ferrflow.com`) (#111)
- feat!: prefer `FERRLABS_API_TOKEN`; `FERRFLOW_API_TOKEN` accepted as a fallback for one release (#111)
- feat!: authenticated endpoint paths now use the `/v1` prefix to match the unified FerrLabs API router (#111)
- feat!: `revoke_token` switched from `POST /tokens/{id}/revoke` to `DELETE /v1/auth/tokens/{id}` (#111)
- feat!: drop FerrFlow CLI-specific tools — `dry_run`, `validate_config`, `read_config`, `read_changelog`, `list_release_tags`, `record_event` removed. They required either a local FerrFlow CLI install or HMAC-signed payloads the MCP doesn't produce. The MCP is now platform-focused; product-specific docs are reachable via `fetch_docs`. (#111)

### Features

- feat(tools): add `list_orgs` and `list_projects` (FerrLabs organizations + projects) (#111)
- feat(tools): add `list_vaults` (FerrVault — secrets management) (#111)
- feat(tools): add `list_issues` (FerrTrack — issue tracker) (#111)
- feat(tools): add `list_subscriptions` (per-product subscription status) (#111)
- feat(tools): add `fetch_docs(product, slug)` — fetch documentation/marketing pages from any FerrLabs product site (ferrflow, ferrvault, ferrtrack, ferrgrowth, ferrfleet, ferrlens, ferrlabs) (#111)

## [3.2.2] - 2026-04-21

### Bug Fixes

- fix(ci): downgrade release.yml pnpm action v6->v5 + FERRFLOW_TOKEN fallback (#94)
- fix(ci): downgrade pnpm/action-setup v6 -> v5 with pinned version (#93)
- fix(ci): rebrand GHCR + GitHub URLs from ferrflow-org to ferrlabs (#91)

## [3.2.1] - 2026-04-01

## [3.2.0] - 2026-04-01

### Features

- feat(tools): add validate_config tool (#67)

## [3.1.0] - 2026-04-01

### Features

- feat: publish @ferrflow/mcp to npm on release (#64)

## [3.0.0] - 2026-04-01

### Breaking Changes

- chore!: remove Docker and HTTP transport, stdio only (#58)

### Features

- feat(tools): add dry_run tool (#55)

## [2.1.0] - 2026-03-31

### Features

- feat(tools): add dry_run tool (#55)

## [1.1.0] - 2026-04-01

### Features

- feat: add stdio transport for local usage (#52)
- feat(tools): add read_changelog tool (#49)
- feat(tools): add list_release_tags tool (#46)

## [0.3.1] - 2026-03-29

### Bug Fixes

- fix(ci): trigger Docker builds on tag creation and use v* tag format (#29)

## [0.3.0] - 2026-03-28

### Features

- feat: add read_config tool (#24)
- feat: initial release
- feat(config): migrate ferrflow config from TOML to JSON
- feat: add Dockerfile and Docker build to CI
- feat: add CI with FerrFlow release action
- feat: initialize MCP server with project templates

### Bug Fixes

- fix: add /health endpoint for K8S readiness probe
- fix: add @types/node for HTTP server types
- fix: use HTTP transport and push latest tag
- fix: pin FerrFlow action to @v0

## [0.2.0] - 2026-03-26

### Features

- feat: initial release
- feat(config): migrate ferrflow config from TOML to JSON
- feat: add Dockerfile and Docker build to CI
- feat: add CI with FerrFlow release action
- feat: initialize MCP server with project templates

### Bug Fixes

- fix: add /health endpoint for K8S readiness probe
- fix: add @types/node for HTTP server types
- fix: use HTTP transport and push latest tag
- fix: pin FerrFlow action to @v0

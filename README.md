# ESET PROTECT MCP Server

MCP server for [ESET PROTECT](https://www.eset.com/int/business/protect-platform/)'s [ESET Connect](https://help.eset.com/eset_connect/en-US/) API gateway - endpoint fleet visibility (devices and groups), detection/EDR investigation, vulnerability data, patch status, and user management - for AI assistants and the WYRE Conduit gateway.

## Authentication

Create a dedicated API user in ESET Business Account: **User Management > create a user with read-only permission > enable the Integrations toggle**. This gives you an email/password pair for that user.

ESET Connect's token endpoint (`POST /oauth/token`) is documented in its own OpenAPI spec as a `password` grant - `username`/`password` fields, not `client_id`/`client_secret` with `grant_type=client_credentials`. This server accepts `clientId`/`clientSecret` (matching the credential shape used across WYRE's other MCP connectors) and sends them as `username`/`password` in that grant. It handles the resulting bearer token's caching and refresh (via the returned `refresh_token`, falling back to a full re-login if the refresh token itself is rejected) internally - callers only ever supply the long-lived email/password pair.

## Configuration

Copy [`.env.example`](.env.example) and set the variables below.

| Env var | Description |
|---|---|
| `ESETPROTECT_CLIENT_ID` | Email of the dedicated ESET Connect API user. Required for stdio and `AUTH_MODE=env`. |
| `ESETPROTECT_CLIENT_SECRET` | Password of that API user. Required for stdio and `AUTH_MODE=env`. |
| `ESETPROTECT_REGION` | `us` (default), `eu`, `de`, `jpn`, or `ca` - the ESET Connect region your ESET Business Account was provisioned in. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via `X-EsetProtect-Client-ID` and `X-EsetProtect-Client-Secret`; `X-EsetProtect-Region` is optional). Gateway mode never falls back to `ESETPROTECT_*`. The container image and Compose default to `gateway`. |
| `CONDUIT_S2S_SECRET` | Required to start the HTTP transport. HMAC key for `X-Gateway-S2S`. The process logs an error and exits non-zero when this is empty or a known placeholder (`changeme`, `replace-with-a-real-secret`, `secret`, `your-s2s-secret`, and the other public example values). Generate one with `openssl rand -hex 32`. The value is never logged. Compose will not start when it is unset. |
| `MCP_ALLOW_INSECURE_DEV` | Set to exactly `1` only for local development to start HTTP without `CONDUIT_S2S_SECRET`. The process logs a warning, does not enforce `X-Gateway-S2S`, and binds `127.0.0.1` only. A non-loopback `MCP_HTTP_HOST` is ignored in that mode. A placeholder secret is still rejected. |
| `MCP_HTTP_HOST` | Bind address when a real `CONDUIT_S2S_SECRET` is set. Defaults to `127.0.0.1` when unset. The container image sets `0.0.0.0`. Without a secret, the listener is forced to `127.0.0.1`. |
| `MCP_HTTP_PORT` | HTTP port. Defaults to `8080`. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

The stdio transport does not use `CONDUIT_S2S_SECRET`. `/health` stays unauthenticated and does not read credentials.

Each ESET Connect API domain (device, incident, vulnerability, patch, and user management) is hosted on its own per-region subdomain, e.g. `https://us.device-management.eset.systems`; the auth host follows the same regional pattern, e.g. `https://us.business-account.iam.eset.systems`. `ESETPROTECT_REGION` selects the prefix for all of them.

### HTTP authentication

With `MCP_TRANSPORT=http` and a real `CONDUIT_S2S_SECRET`, every `/mcp` request must include `X-Gateway-S2S`:

```
t=<unix seconds>,v1=<hex hmac-sha256>
```

`v1` is the hex-encoded HMAC-SHA256 of the exact prefix `t=<unix seconds>`, keyed with `CONDUIT_S2S_SECRET`. The timestamp must be within five minutes of the server clock. A missing or invalid header returns 401. The secret value is never written to logs or response bodies.

In `AUTH_MODE=gateway`, `/mcp` also requires `X-EsetProtect-Client-ID` and `X-EsetProtect-Client-Secret` (`X-EsetProtect-Region` is optional: `us`, `eu`, `de`, `jpn`, or `ca`). Those headers are the only credential source for that request. A request missing either required header returns 401 and does not fall back to `ESETPROTECT_*` in the process environment.

## Tools

### Device Management
- `esetprotect_list_device_groups` - list device groups.
- `esetprotect_list_group_devices` - list the devices in a group.
- `esetprotect_list_devices` - list managed devices, filterable by display name, functionality status, or mute state.
- `esetprotect_get_device` - get a device by UUID.
- `esetprotect_batch_get_devices` - get multiple devices by UUID in one call.

### Incident Management (detections, detection groups, EDR)
- `esetprotect_list_detections` / `esetprotect_get_detection` - v1 detections (legacy surface).
- `esetprotect_list_detections_v2` / `esetprotect_get_detection_v2` / `esetprotect_batch_get_detections` - v2 detections (endpoint, cloud office, and EDR).
- `esetprotect_list_detection_groups` / `esetprotect_get_detection_group` - detections clustered into groups.
- `esetprotect_list_edr_rules` / `esetprotect_get_edr_rule` - EDR detection rules.
- `esetprotect_list_edr_rule_exclusions` / `esetprotect_get_edr_rule_exclusion` - EDR rule exclusions.

### Vulnerability Management
- `esetprotect_list_device_os_vulnerabilities` - OS vulnerabilities found on devices.
- `esetprotect_list_device_vulnerabilities` - vulnerabilities found on devices (application/OS/package scope).
- `esetprotect_list_recent_scans` - recent vulnerability scan details.
- `esetprotect_list_vulnerable_devices` - devices with known vulnerabilities.

### Patch Management
- `esetprotect_list_recent_application_patching_details` - most recent application-patching processes fleet-wide.
- `esetprotect_list_device_patches` - patches for devices, filterable by patch type.
- `esetprotect_list_patching_process_details` - detailed patching-process history within a time window.

### User Management
- `esetprotect_list_users` - list users, filterable by email, display name, protection status, and more.
- `esetprotect_get_user` - get a user by UUID.
- `esetprotect_batch_get_users` - get multiple users by UUID in one call (atomic - all or none).

## Scope

This is a v1, read-only fleet/security-visibility surface. Explicitly deferred: device move/rename and batch import, detection and detection-group resolve, EDR rule and rule-exclusion create/update/delete, and any asset-management group create/delete/move/rename endpoints. These are mutation/provisioning actions out of scope for a read-only monitoring connector and can be added as a follow-up.

The incident-management API also exposes a separate `/v2/incidents` case-management surface (list/get/close/reopen, comments) alongside detections and detection-groups; it is not covered by this v1 surface either, for the same reason.

## Development

```bash
npm install
npm run build
npm test
npm run lint   # tsc --noEmit
```

## Docker

The image listens on `0.0.0.0` inside the container (`MCP_HTTP_HOST`) and defaults to `AUTH_MODE=gateway`. Startup still refuses to run without a real `CONDUIT_S2S_SECRET` (empty values and known placeholders exit). Publish the port on loopback. In gateway mode, ESET credentials arrive on each request as headers; they are not read from the environment.

```bash
docker build -t eset-protect-mcp .
docker run \
  -e CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" \
  -p 127.0.0.1:8080:8080 \
  eset-protect-mcp
```

Compose refuses to start when `CONDUIT_S2S_SECRET` is unset, defaults `AUTH_MODE` to `gateway`, publishes `127.0.0.1:8080:8080`, and does not pass `ESETPROTECT_CLIENT_ID`, `ESETPROTECT_CLIENT_SECRET`, or `env_file` into the container:

```bash
# openssl rand -hex 32 — do not use a placeholder such as changeme
CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" docker compose up
```

Single-tenant HTTP (`AUTH_MODE=env`) still requires the S2S secret, then uses `ESETPROTECT_CLIENT_ID` and `ESETPROTECT_CLIENT_SECRET`:

```bash
docker run \
  -e CONDUIT_S2S_SECRET="$CONDUIT_S2S_SECRET" \
  -e AUTH_MODE=env \
  -e ESETPROTECT_CLIENT_ID=api-user@example.com \
  -e ESETPROTECT_CLIENT_SECRET=... \
  -e ESETPROTECT_REGION=us \
  -p 127.0.0.1:8080:8080 \
  eset-protect-mcp
```

Local HTTP without a secret is development-only. It binds `127.0.0.1` and logs a warning. A non-loopback `MCP_HTTP_HOST` (including the image default `0.0.0.0`) is ignored and the listener stays on `127.0.0.1`:

```bash
MCP_TRANSPORT=http MCP_ALLOW_INSECURE_DEV=1 npm run start:http
```

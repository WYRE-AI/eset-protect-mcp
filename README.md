# ESET PROTECT MCP Server

MCP server for [ESET PROTECT](https://www.eset.com/int/business/protect-platform/)'s [ESET Connect](https://help.eset.com/eset_connect/en-US/) API gateway - endpoint fleet visibility (devices and groups), detection/EDR investigation, vulnerability data, patch status, and user management - for AI assistants and the WYRE Conduit gateway.

## Authentication

Create a dedicated API user in ESET Business Account: **User Management > create a user with read-only permission > enable the Integrations toggle**. This gives you an email/password pair for that user.

ESET Connect's token endpoint (`POST /oauth/token`) is documented in its own OpenAPI spec as a `password` grant - `username`/`password` fields, not `client_id`/`client_secret` with `grant_type=client_credentials`. This server accepts `clientId`/`clientSecret` (matching the credential shape used across WYRE's other MCP connectors) and sends them as `username`/`password` in that grant. It handles the resulting bearer token's caching and refresh (via the returned `refresh_token`, falling back to a full re-login if the refresh token itself is rejected) internally - callers only ever supply the long-lived email/password pair.

## Configuration

| Env var | Description |
|---|---|
| `ESETPROTECT_CLIENT_ID` | Email of the dedicated ESET Connect API user. |
| `ESETPROTECT_CLIENT_SECRET` | Password of that API user. |
| `ESETPROTECT_REGION` | `us` (default), `eu`, `de`, `jpn`, or `ca` - the ESET Connect region your ESET Business Account was provisioned in. |
| `MCP_TRANSPORT` | `stdio` (default) or `http`. |
| `AUTH_MODE` | `env` (default, reads the vars above) or `gateway` (credentials arrive per-request via `X-EsetProtect-*` headers, injected by the Conduit gateway). |
| `CONDUIT_S2S_SECRET` | When set, the HTTP transport requires a valid `X-Gateway-S2S` header (Conduit sidecar auth) on every `/mcp` request. |
| `LOG_LEVEL` | `debug` \| `info` (default) \| `warn` \| `error`. |

Each ESET Connect API domain (device, incident, vulnerability, patch, and user management) is hosted on its own per-region subdomain, e.g. `https://us.device-management.eset.systems`; the auth host follows the same regional pattern, e.g. `https://us.business-account.iam.eset.systems`. `ESETPROTECT_REGION` selects the prefix for all of them.

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

```bash
docker build -t eset-protect-mcp .
docker run -p 8080:8080 \
  -e ESETPROTECT_CLIENT_ID=... \
  -e ESETPROTECT_CLIENT_SECRET=... \
  eset-protect-mcp
```

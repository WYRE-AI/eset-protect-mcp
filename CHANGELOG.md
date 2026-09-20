# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release: MCP server for ESET PROTECT's ESET Connect API.
- Device management tools: `esetprotect_list_device_groups`, `esetprotect_list_group_devices`, `esetprotect_list_devices`, `esetprotect_get_device`, `esetprotect_batch_get_devices`.
- Incident management tools: `esetprotect_list_detections`, `esetprotect_get_detection`, `esetprotect_list_detections_v2`, `esetprotect_get_detection_v2`, `esetprotect_batch_get_detections`, `esetprotect_list_detection_groups`, `esetprotect_get_detection_group`, `esetprotect_list_edr_rules`, `esetprotect_get_edr_rule`, `esetprotect_list_edr_rule_exclusions`, `esetprotect_get_edr_rule_exclusion`.
- Vulnerability management tools: `esetprotect_list_device_os_vulnerabilities`, `esetprotect_list_device_vulnerabilities`, `esetprotect_list_recent_scans`, `esetprotect_list_vulnerable_devices`.
- Patch management tools: `esetprotect_list_recent_application_patching_details`, `esetprotect_list_device_patches`, `esetprotect_list_patching_process_details`.
- User management tools: `esetprotect_list_users`, `esetprotect_get_user`, `esetprotect_batch_get_users`.
- Transparent OAuth2 password-grant token exchange and refresh (`POST /oauth/token`) wrapping every tool call, keyed by the full credential set to keep multi-tenant token caching isolated per customer.
- Regional endpoint support (`us`/`eu`/`de`/`jpn`/`ca`) via the `ESETPROTECT_REGION` credential field, applied to both the auth host and each of the five per-domain API hosts.
- Distinct error handling for invalid credentials (HTTP 401) versus rate limiting (HTTP 429).
